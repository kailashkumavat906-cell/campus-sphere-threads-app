import OptionModal from '@/components/OptionModal';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  BRANCH_OPTIONS,
  COLLEGE_OPTIONS,
  COURSE_OPTIONS,
  SEMESTER_OPTIONS,
  useUserProfileData,
} from '@/hooks/useUserProfileData';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function EditProfileModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const { userProfile, isLoading: isUserProfileLoading } = useUserProfile();
  const { user: clerkUser } = useUser();
  
  // Get userId from params first, then fallback to userProfile
  const userId = (params.userId as string) || userProfile?._id;
  
  // Fetch user data directly using the resolved userId
  const userData = useQuery(
    api.users.getUserById,
    userId ? { userId: userId as Id<'users'> } : 'skip'
  );

  // Centralized profile data hook
  const { profileData, saveProfileData } = useUserProfileData();

  // Centralized form state with useRef for persistence across remounts
  const formRef = useRef({
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
    website: '',
    college: '',
    course: '',
    branch: '',
    semester: '',
    avatar: null as string | null,
  });
  
  const [form, setForm] = useState(formRef.current);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [pendingStorageId, setPendingStorageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Centralized update function - prevents stale closures
  const updateForm = (key: keyof typeof formRef.current, value: string | null) => {
    formRef.current = { ...formRef.current, [key]: value };
    setForm(formRef.current);
  };

  // Debug form state changes
  useEffect(() => {
    console.log('FORM STATE:', form);
  }, [form]);

  // Dropdown states
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);

  const updateUser = useMutation(api.users.updateUser);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateUserImage = useMutation(api.users.updateUserImage);

  const fileUrl = useQuery(
    api.users.getFileUrl,
    pendingStorageId ? { storageId: pendingStorageId } : 'skip'
  );

  // Initialize form with user data when available - only runs once
  useEffect(() => {
    if (userData) {
      // Set all form fields from user data
      const initialForm = {
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        username: userData.username || '',
        bio: userData.bio || '',
        website: userData.websiteUrl || '',
        college: userData.college || '',
        course: userData.course || '',
        branch: userData.branch || '',
        semester: userData.semester || '',
        avatar: null,
      };
      formRef.current = initialForm;
      setForm(initialForm);
      setImageUrl(userData.imageUrl || undefined);
    }
  }, [userData]);

  // Determine loading state
  const isLoadingData = !userId || isUserProfileLoading || (userData === undefined && userId);
  
  if (isLoadingData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={[styles.loadingText, { color: colors.icon }]}>Loading profile...</Text>
        {!userId && (
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>
            User ID not found. Please log out and log back in.
          </Text>
        )}
      </View>
    );
  }

  // If we still don't have userId after loading, show error
  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: '#FF3B30' }]}>
          Error: Unable to load user profile. Please restart the app.
        </Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={[styles.button, { backgroundColor: colors.tint || '#0095F6' }]}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];

      // Update avatar using centralized updateForm - does NOT reset other fields
      updateForm('avatar', asset.uri);

      try {
        setIsLoading(true);
        const uploadUrl = await generateUploadUrl();

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: await fetch(asset.uri).then((res) => res.blob()),
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        setPendingStorageId(data.storageId);
      } catch (error) {
        console.error('Upload failed:', error);
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please log out and log back in.');
      return;
    }

    if (pendingStorageId && !fileUrl) {
      Alert.alert('Please wait', 'Still processing your image upload...');
      return;
    }

    setIsSaving(true);
    
    try {
      // Update first name, last name, username, bio, website, and education fields in Convex
      await updateUser({
        _id: userId as Id<'users'>,
        first_name: form.firstName,
        last_name: form.lastName,
        username: form.username,
        bio: form.bio,
        websiteUrl: form.website,
        college: form.college,
        course: form.course,
        branch: form.branch,
        semester: form.semester,
      });

      // Update Clerk profile if name changed
      if (clerkUser) {
        try {
          await clerkUser.update({
            firstName: form.firstName,
            lastName: form.lastName,
          });
        } catch (clerkError) {
          console.error('Failed to update Clerk profile:', clerkError);
          // Continue even if Clerk update fails - Convex update succeeded
        }
      }

      // Update profile image if needed
      if (fileUrl) {
        await updateUserImage({
          _id: userId as Id<'users'>,
          imageUrl: fileUrl,
        });
        setImageUrl(fileUrl);
      }
      setPendingStorageId(null);

      // Save all profile data to AsyncStorage
      await saveProfileData({
        college: form.college,
        course: form.course,
        branch: form.branch,
        semester: form.semester,
      });

      router.back();
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const displayImageUrl = form.avatar || fileUrl || imageUrl;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={handleCancel}>
          <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Edit profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={[styles.saveText, { color: colors.tint }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={pickImage} disabled={isLoading}>
            {displayImageUrl ? (
              <Image source={{ uri: displayImageUrl }} style={styles.photo} />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Text style={styles.placeholderPhotoText}>Add Photo</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* First Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>First Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            value={form.firstName}
            onChangeText={(text) => updateForm('firstName', text)}
            placeholder="Enter your first name"
            placeholderTextColor={colors.icon}
          />
        </View>

        {/* Last Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Last Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            value={form.lastName}
            onChangeText={(text) => updateForm('lastName', text)}
            placeholder="Enter your last name"
            placeholderTextColor={colors.icon}
          />
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Username</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            value={form.username}
            onChangeText={(text) => updateForm('username', text)}
            placeholder="Enter your username"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
          />
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Bio</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                color: colors.text,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            value={form.bio}
            onChangeText={(text) => updateForm('bio', text)}
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.icon}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Website */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Website</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            value={form.website}
            onChangeText={(text) => updateForm('website', text)}
            placeholder="https://yourwebsite.com"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
          />
        </View>

        {/* College - Hybrid Input + Dropdown */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>College Name</Text>
          <View style={styles.hybridInputContainer}>
            <TextInput
              style={[
                styles.hybridInput,
                {
                  color: colors.text,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              value={form.college}
              onChangeText={(text) => updateForm('college', text)}
              placeholder="Enter college name"
              placeholderTextColor={colors.icon}
            />
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => setShowCollegeModal(true)}
            >
              <Text style={[styles.dropdownIcon, { color: colors.icon }]}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Course - Hybrid Input + Dropdown */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Course</Text>
          <View style={styles.hybridInputContainer}>
            <TextInput
              style={[
                styles.hybridInput,
                {
                  color: colors.text,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              value={form.course}
              onChangeText={(text) => updateForm('course', text)}
              placeholder="e.g., B.Tech, BBA, BCA"
              placeholderTextColor={colors.icon}
            />
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => setShowCourseModal(true)}
            >
              <Text style={[styles.dropdownIcon, { color: colors.icon }]}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Branch - Hybrid Input + Dropdown */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Branch</Text>
          <View style={styles.hybridInputContainer}>
            <TextInput
              style={[
                styles.hybridInput,
                {
                  color: colors.text,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              value={form.branch}
              onChangeText={(text) => updateForm('branch', text)}
              placeholder="e.g., Computer Engineering"
              placeholderTextColor={colors.icon}
            />
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => setShowBranchModal(true)}
            >
              <Text style={[styles.dropdownIcon, { color: colors.icon }]}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Semester - Hybrid Input + Dropdown */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Semester</Text>
          <View style={styles.hybridInputContainer}>
            <TextInput
              style={[
                styles.hybridInput,
                {
                  color: colors.text,
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              value={form.semester}
              onChangeText={(text) => updateForm('semester', text)}
              placeholder="e.g., Semester 6"
              placeholderTextColor={colors.icon}
            />
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => setShowSemesterModal(true)}
            >
              <Text style={[styles.dropdownIcon, { color: colors.icon }]}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* College Selection Modal */}
      <OptionModal
        visible={showCollegeModal}
        onClose={() => setShowCollegeModal(false)}
        title="Select College"
        options={COLLEGE_OPTIONS}
        selectedValue={form.college}
        onSelect={(value) => {
          updateForm('college', value);
          setShowCollegeModal(false);
        }}
        colors={colors}
      />

      {/* Course Selection Modal */}
      <OptionModal
        visible={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title="Select Course"
        options={COURSE_OPTIONS}
        selectedValue={form.course}
        onSelect={(value) => {
          updateForm('course', value);
          setShowCourseModal(false);
        }}
        colors={colors}
      />

      {/* Branch Selection Modal */}
      <OptionModal
        visible={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title="Select Branch"
        options={BRANCH_OPTIONS}
        selectedValue={form.branch}
        onSelect={(value) => {
          updateForm('branch', value);
          setShowBranchModal(false);
        }}
        colors={colors}
      />

      {/* Semester Selection Modal */}
      <OptionModal
        visible={showSemesterModal}
        onClose={() => setShowSemesterModal(false)}
        title="Select Semester"
        options={SEMESTER_OPTIONS}
        selectedValue={form.semester}
        onSelect={(value) => {
          updateForm('semester', value);
          setShowSemesterModal(false);
        }}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  placeholderPhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DBE4EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderPhotoText: {
    color: '#87929D',
    fontSize: 14,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#DBE4EB',
    borderRadius: 10,
    padding: 6,
  },
  editBadgeText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: '600',
  },
  field: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
  },
  hybridInputContainer: {
    flexDirection: 'row',
  },
  hybridInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  dropdownButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 0,
  },
  dropdownIcon: {
    fontSize: 12,
  },
});
