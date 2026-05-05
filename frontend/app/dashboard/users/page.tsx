"use client"

import { useState, useEffect } from 'react';
import { getAllUsersAction, updateUserRoleAction, preRegisterUserAction } from '@/lib/actions';
import { Shield, Mail, Calendar, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Add User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('INTERN');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const data = await getAllUsersAction();
    setUsers(data);
    setLoading(false);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    
    setIsAdding(true);
    const result = await preRegisterUserAction({ email: newEmail, role: newRole });
    if (result.success) {
      setNewEmail('');
      setShowAddForm(false);
      fetchUsers(); // Refresh list
    } else {
      alert("Failed to pre-register user");
    }
    setIsAdding(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingId(userId);
    const result = await updateUserRoleAction(userId, newRole);
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } else {
      alert("Failed to update role");
    }
    setUpdatingId(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-muted-foreground">Pre-authorize emails or assign roles to platform members</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Add User Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddUser}
            className="bg-card border border-primary/20 p-6 rounded-3xl space-y-4 overflow-hidden"
          >
            <h3 className="font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Pre-authorize New Member
            </h3>
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="intern@example.com"
                  className="w-full bg-muted/20 border border-border/50 rounded-xl py-2.5 px-4 focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              <div className="w-48 space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Role</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-muted/20 border border-border/50 rounded-xl py-2.5 px-4 focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="MANAGER">MANAGER</option>
                  <option value="INTERN">INTERN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={isAdding}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching member directory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {users.map((user, index) => (
            <motion.div 
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card border border-border/50 p-6 rounded-3xl flex items-center justify-between group hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary group-hover:scale-110 transition-transform">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{user.email}</span>
                    {!user.firebaseUid && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 font-bold border border-yellow-500/20">
                        PENDING JOIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {updatingId === user.id ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-xl border border-border/50">
                    {['ADMIN', 'MANAGER', 'INTERN'].map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(user.id, role)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          user.role === role 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
