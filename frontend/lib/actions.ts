"use server"

import prisma from './prisma';
import { Role } from '@prisma/client';

/**
 * Fetches the RBAC role for a given Firebase UID from Supabase.
 */
export async function getUserRole(firebaseUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { role: true }
    });
    return user?.role || null;
  } catch (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
}

/**
 * Syncs a Firebase user with the Supabase database.
 * If the email is pre-registered, it claims the record by adding the UID.
 */
export async function syncUserAction(data: { email: string, firebaseUid: string }) {
  try {
    // 1. Check if user exists by email (pre-registered)
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      // If found but UID is missing or a placeholder, claim it
      if (!existing.firebaseUid || existing.firebaseUid.startsWith('PRE_AUTH_')) {
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: { firebaseUid: data.firebaseUid }
        });
        return { success: true, user: updated };
      }
      return { success: true, user: existing };
    }

    // 2. STRICT: If not found, do NOT create. Return error.
    return { success: false, error: "Access Denied: Your email is not authorized. Please contact an Admin." };
  } catch (error) {
    console.error("Error syncing user:", error);
    return { success: false, error: "Database synchronization failed." };
  }
}

/**
 * Admin: Pre-registers a user by email and role.
 */
export async function preRegisterUserAction(data: { email: string, role: string }) {
  try {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: { role: data.role as Role },
      create: {
        email: data.email,
        role: data.role as Role,
        firebaseUid: `PRE_AUTH_${data.email.toUpperCase()}`
      }
    });
    return { success: true, user };
  } catch (error) {
    console.error("Error pre-registering user:", error);
    return { success: false };
  }
}

/**
 * Admin: Fetches all users from the database.
 */
export async function getAllUsersAction() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' }
    });
    return users.map(u => ({
      ...u,
      createdAt: u.createdAt.toISOString()
    }));
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

/**
 * Admin: Updates a user's role.
 */
export async function updateUserRoleAction(userId: string, newRole: string) {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole as Role }
    });
    return { success: true, user: updated };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false };
  }
}

/**
 * Fetches all documents that a specific role is allowed to view.
 */
export async function getDocuments(role: string) {
  try {
    const docs = await prisma.document.findMany({
      where: {
        allowedRoles: {
          has: role as Role
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return docs.map(doc => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching documents:", error);
    return [];
  }
}

/**
 * Saves document metadata to Supabase.
 */
export async function uploadDocumentAction(data: {
  title: string;
  fileUrls: string[];
  allowedRoles: string[];
  firebaseUid: string;
}) {
  try {
    console.log("Starting uploadDocumentAction with UID:", data.firebaseUid);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: data.firebaseUid }
    });
    console.log("User lookup result:", user ? "Found" : "Not Found");

    if (!user || user.role !== 'ADMIN') {
      throw new Error("Unauthorized: Only admins can upload documents.");
    }

    // Diagnostic check mode - don't save to DB
    if (data.title === "CHECK") {
      return { success: true };
    }

    console.log("Creating document in Prisma...");
    const doc = await prisma.document.create({
      data: {
        title: data.title,
        fileUrls: data.fileUrls,
        allowedRoles: data.allowedRoles as Role[],
        authorId: user.id
      }
    });
    console.log("Document created successfully:", doc.id);
    
    // 🔑 Trigger Ingestion Pipeline in Backend for ALL files in this document/collection
    if (data.fileUrls.length > 0) {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        
        // Trigger ingestion for each file URL
        data.fileUrls.forEach(url => {
          console.log(`Triggering ingestion for: ${url} (Collection: ${doc.id})`);
          fetch(`${backendUrl}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              pdf_url: url,
              collection_id: doc.id 
            })
          }).then(res => res.json())
            .then(resData => console.log(`Ingestion started for ${url}:`, resData))
            .catch(err => console.error(`Ingestion trigger failed for ${url}:`, err));
        });
          
      } catch (ingestErr) {
        console.error("Failed to trigger multi-file ingestion:", ingestErr);
      }
    }

    return { success: true, doc };
  } catch (error) {
    console.error("Error in uploadDocumentAction:", error);
    return { success: false, error: "Failed to save document metadata." };
  }
}

/**
 * Fetches a single document by ID, verifying role access.
 */
export async function getNotebookAction(id: string, role: string) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id }
    });

    if (doc && doc.allowedRoles.includes(role as Role)) {
      return {
        ...doc,
        id: doc.id,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error("Error in getNotebookAction:", error);
    return null;
  }
}

/**
 * Updates the title of a notebook (Admin only).
 */
export async function updateNotebookTitleAction(id: string, title: string, role: string) {
  try {
    if (role !== 'ADMIN') throw new Error("Unauthorized");
    
    const updated = await prisma.document.update({
      where: { id },
      data: { title }
    });

    return { success: true, doc: updated };
  } catch (error) {
    console.error("Error in updateNotebookTitleAction:", error);
    return { success: false };
  }
}

/**
 * Admin: Uploads a file to Cloudinary using the API Secret (Signed Upload).
 */
export async function uploadToCloudinaryAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file provided");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dynamic import to avoid client-side issues
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "docguard_notebooks",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return { success: true, url: (result as any).secure_url };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return { success: false, error: "Upload failed." };
  }
}

/**
 * Creates a new chat session for a user and document.
 */
export async function createChatSessionAction(documentId: string, firebaseUid: string, title: string = "New Chat") {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new Error("User not found");

    const session = await prisma.chatSession.create({
      data: {
        title,
        documentId,
        userId: user.id
      }
    });
    return { success: true, session };
  } catch (error) {
    console.error("Error creating chat session:", error);
    return { success: false };
  }
}

/**
 * Gets all chat sessions for a user and document.
 */
export async function getChatSessionsAction(documentId: string, firebaseUid: string) {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new Error("User not found");

    const sessions = await prisma.chatSession.findMany({
      where: { documentId, userId: user.id },
      orderBy: { updatedAt: 'desc' }
    });
    
    return sessions.map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }
}

/**
 * Gets messages for a chat session.
 */
export async function getChatMessagesAction(chatSessionId: string) {
  try {
    const messages = await prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: 'asc' }
    });
    return messages.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

/**
 * Saves a new message to a chat session.
 */
export async function saveChatMessageAction(chatSessionId: string, role: string, content: string) {
  try {
    const message = await prisma.message.create({
      data: {
        chatSessionId,
        role,
        content
      }
    });

    // Update the session's updatedAt timestamp
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { updatedAt: new Date() }
    });

    return { success: true, message };
  } catch (error) {
    console.error("Error saving message:", error);
    return { success: false };
  }
}

/**
 * Calls the Python backend to generate a summary for a given PDF URL.
 */
export async function chatAction(documentId: string, query: string) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        query,
        collection_id: documentId 
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data = await response.json();
    return { success: true, answer: data.answer };
  } catch (error) {
    console.error("Error calling chat endpoint:", error);
    return { success: false, error: "Could not connect to chat backend." };
  }
}

/**
 * Calls the Python backend to generate a summary for a given PDF URL.
 */
export async function generateSummaryAction(pdfUrl: string) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: pdfUrl }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data = await response.json();
    return { success: true, summary: data.summary };
  } catch (error) {
    console.error("Error calling summarize endpoint:", error);
    return { success: false, error: "Could not connect to summarization backend." };
  }
}

/**
 * Updates a chat session's title.
 */
export async function updateChatSessionTitleAction(chatSessionId: string, title: string) {
  try {
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { title }
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating chat session title:", error);
    return { success: false };
  }
}

/**
 * Calls the local Next.js API to generate a podcast audio file from text.
 */
export async function generatePodcastFromTextAction(data: {
  text: string;
  title?: string;
  topic?: string;
  hostVoice?: string;
  guestVoice?: string;
  maxTurns?: number;
}) {
  try {
    const { headers } = await import('next/headers');
    const host = headers().get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/podcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json();
      return { success: false, error: err.error || "Failed to generate podcast" };
    }

    const result = await response.json();
    return { success: true, audioUrl: result.audioUrl };
  } catch (error) {
    console.error("Error calling podcast API:", error);
    return { success: false, error: "Could not connect to podcast API." };
  }
}

/**
 * Fetches all text content for a specific page from the backend.
 */
export async function getPageContentAction(pageNum: number, collectionId: string) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/page_content/${collectionId}/${pageNum}`);

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data = await response.json();
    return { success: true, content: data.content };
  } catch (error) {
    console.error("Error calling page_content endpoint:", error);
    return { success: false, error: "Could not connect to backend." };
  }
}

/**
 * Calls the Python backend to generate an audio podcast based on a given PDF URL.
 */
export async function generatePodcastAction(pdfUrl: string, query?: string, sourceText?: string, pageNumber?: number) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/podcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pdf_url: pdfUrl, 
        query, 
        source_text: sourceText, 
        page_number: pageNumber 
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data = await response.json();
    return { 
      success: true, 
      audioBase64: data.audio_base64, 
      script: data.script,
      summary: data.summary 
    };
  } catch (error) {
    console.error("Error calling backend podcast pipeline:", error);
    return { success: false, error: "Could not connect to backend pipeline." };
  }
}

/**
 * Deletes a chat session and all its messages.
 */
export async function deleteChatSessionAction(chatSessionId: string) {
  try {
    await prisma.chatSession.delete({
      where: { id: chatSessionId }
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return { success: false };
  }
}
