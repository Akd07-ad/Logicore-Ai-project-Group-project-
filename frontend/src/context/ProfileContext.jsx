/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile } from '../utils/api';

const ProfileContext = createContext(null);

const emptyProfile = {
  full_name: '',
  student_id: '',
  department: '',
  target_cgpa: null,
  image_url: '',
};

function normalizeProfile(payload = {}) {
  return {
    full_name: payload.full_name || '',
    student_id: payload.student_id || '',
    department: payload.department || '',
    target_cgpa: payload.target_cgpa ?? null,
    image_url: payload.image_url || payload.profile_picture || '',
  };
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(emptyProfile);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setProfile(emptyProfile);
      return emptyProfile;
    }

    try {
      const response = await fetchProfile();
      const normalized = normalizeProfile(response?.data || {});
      setProfile(normalized);
      return normalized;
    } catch {
      return emptyProfile;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      refreshProfile,
    }),
    [profile, refreshProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const contextValue = useContext(ProfileContext);
  if (!contextValue) {
    throw new Error('useProfileContext must be used inside ProfileProvider');
  }
  return contextValue;
}
