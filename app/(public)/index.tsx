import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// This is the entry point - redirect to signup
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to signup page as the default authentication page
    router.replace('/signup');
  }, [router]);

  return null;
}
