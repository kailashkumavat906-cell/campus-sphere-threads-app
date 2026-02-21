import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export type UserProfileData = {
  college: string;
  course: string;
  branch: string;
  semester: string;
};

const STORAGE_KEY = 'userProfile';

const DEFAULT_DATA: UserProfileData = {
  college: '',
  course: '',
  branch: '',
  semester: '',
};

export function useUserProfileData() {
  const [profileData, setProfileData] = useState<UserProfileData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadedRef = useRef(false);

  // Load profile data from AsyncStorage
  const loadProfileData = useCallback(async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        setProfileData(JSON.parse(savedData));
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
      isLoadedRef.current = true;
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Save profile data to AsyncStorage
  const saveProfileData = useCallback(async (data: UserProfileData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setProfileData(data);
    } catch (error) {
      console.error('Error saving profile data:', error);
    }
  }, []);

  // Update a single field
  const updateField = useCallback(
    (field: keyof UserProfileData, value: string) => {
      const newData = { ...profileData, [field]: value };
      saveProfileData(newData);
    },
    [profileData, saveProfileData]
  );

  // Clear all profile data
  const clearProfileData = useCallback(async () => {
    await saveProfileData(DEFAULT_DATA);
  }, [saveProfileData]);

  // Refresh data (called when screen comes into focus)
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadProfileData();
  }, [loadProfileData]);

  return {
    profileData,
    isLoading,
    saveProfileData,
    updateField,
    clearProfileData,
    refresh,
  };
}

// Helper function to get formatted display string
export function getProfileDisplayString(data: UserProfileData): string {
  const parts: string[] = [];

  if (data.college) parts.push(data.college);
  if (data.course) parts.push(data.course);
  if (data.branch) parts.push(data.branch);
  if (data.semester) {
    // Format "Semester 6" as "Sem 6"
    const semesterShort = data.semester.replace(/Semester\s+/i, 'Sem ');
    parts.push(semesterShort);
  }

  return parts.join(' • ');
}

// Available options for dropdowns
export const COLLEGE_OPTIONS = [
  'GLS University',
  'Gujarat University',
  'Nirma University',
  'Ahmedabad University',
  'LD College of Engineering',
  'Silver Oak University',
  'Indus University',
  'CEPT University',
  "St. Xavier's College",
  'HL College of Commerce',
  'Gujarat College of Science',
  'Maharaja Sayajirao University',
  'Other',
];

export const COURSE_OPTIONS = [
  'B.Tech',
  'B.E.',
  'B.Sc.',
  'B.Com.',
  'BBA',
  'BCA',
  'MBA',
  'M.Tech',
  'M.Sc.',
  'M.Com',
  'MCA',
  'B.A.',
  'M.A.',
  'Diploma',
  'Other',
];

export const BRANCH_OPTIONS = [
  'Computer Engineering',
  'Information Technology',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics & Communication',
  'Data Science',
  'Artificial Intelligence',
  'Cyber Security',
  'Business Administration',
  'Commerce',
  'Arts',
  'Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Other',
];

export const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
];
