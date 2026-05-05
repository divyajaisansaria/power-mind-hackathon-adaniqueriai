import { create } from 'zustand';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserRole } from './actions';

interface AuthState {
  user: User | null;
  role: 'ADMIN' | 'MANAGER' | 'INTERN' | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setRole: (role: 'ADMIN' | 'MANAGER' | 'INTERN' | null) => void;
  fetchUserRole: (uid: string) => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  fetchUserRole: async (uid: string) => {
    try {
      const role = await getUserRole(uid);
      set({ role: role as any, error: null });
    } catch (error) {
      console.error("Error fetching user role:", error);
      set({ role: null });
    }
  },
  init: () => {
    onAuthStateChanged(auth, async (user) => {
      set({ user, loading: true, error: null });
      if (user) {
        try {
          const { syncUserAction } = await import('./actions');
          const result = await syncUserAction({ 
            email: user.email || '', 
            firebaseUid: user.uid 
          });
          
          if (!result.success) {
            set({ error: result.error as string, role: null });
          } else {
            await get().fetchUserRole(user.uid);
          }
        } catch (err) {
          console.error("Sync error:", err);
          set({ error: "Authentication failed. Please try again." });
        }
      } else {
        set({ role: null, error: null });
      }
      set({ loading: false });
    });
  },
}));
