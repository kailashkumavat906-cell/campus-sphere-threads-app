import ThreadComposer from '@/components/ThreadComposer';
import { useLocalSearchParams } from 'expo-router';


const Page = () => {
    const { draftId } = useLocalSearchParams();
    return <ThreadComposer draftId={draftId as string | undefined} />;
};
export default Page;
