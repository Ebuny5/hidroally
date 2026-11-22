import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types';

const PROFILE_UPDATED_EVENT = 'sweatsmart:profile-updated';

export const useProfile = () => {
  const { user } = useAuth();
  const cacheKey = user ? `hidroally:profile:${user.id}` : '';
  const readCache = (): Profile | null => {
    if (!cacheKey) return null;
    try { const r = localStorage.getItem(cacheKey); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const writeCache = (p: Profile | null) => {
    if (!cacheKey || !p) return;
    try { localStorage.setItem(cacheKey, JSON.stringify(p)); } catch { /* ignore */ }
  };
  const [profile, setProfile] = useState<Profile | null>(() => readCache());
  const [loading, setLoading] = useState(() => !readCache());

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(prev => prev ?? readCache());
      } else {
        setProfile(data as unknown as Profile);
        writeCache(data as unknown as Profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(prev => prev ?? readCache());
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setProfile(prev => {
        const next = prev ? { ...prev, ...updates } : null;
        writeCache(next);
        return next;
      });
      if (typeof updates.display_name === 'string' && updates.display_name.trim()) {
        void supabase.auth.updateUser({ data: { display_name: updates.display_name.trim(), full_name: updates.display_name.trim() } });
      }
      // Notify other useProfile instances (e.g. Header) to refresh
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  useEffect(() => {
    const cached = readCache();
    if (cached) { setProfile(cached); setLoading(false); }
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const handler = () => { fetchProfile(); };
    window.addEventListener(PROFILE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handler);
  }, [user]);

  return { profile, loading, updateProfile, refetch: fetchProfile };
};
