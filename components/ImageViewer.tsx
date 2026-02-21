import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ImageViewerProps = {
    visible: boolean;
    imageUrl: string;
    onClose: () => void;
};

const ImageViewer: React.FC<ImageViewerProps> = ({ visible, imageUrl, onClose }) => {
    // Always call hooks at the top - never conditionally
    const scale = useRef(new Animated.Value(1)).current;
    const [isZoomed, setIsZoomed] = useState(false);

    const handleZoomIn = useCallback(() => {
        Animated.spring(scale, {
            toValue: 2,
            useNativeDriver: true,
        }).start();
        setIsZoomed(true);
    }, [scale]);

    const handleZoomOut = useCallback(() => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
        setIsZoomed(false);
    }, [scale]);

    const handlePress = useCallback(() => {
        if (isZoomed) {
            handleZoomOut();
        } else {
            handleZoomIn();
        }
    }, [isZoomed, handleZoomIn, handleZoomOut]);

    const handleClose = useCallback(() => {
        scale.setValue(1);
        setIsZoomed(false);
        onClose();
    }, [scale, onClose]);

    // Now we can conditionally return - hooks are already called
    if (!visible || !imageUrl || imageUrl.trim() === '') {
        return null;
    }

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={handleClose}>
            <View style={styles.container}>
                <Animated.Image
                    source={{ uri: imageUrl }}
                    style={[
                        styles.image,
                        {
                            transform: [{ scale }],
                        },
                    ]}
                    resizeMode="contain"
                />

                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={handleZoomIn} style={styles.zoomButton}>
                        <Ionicons name="add" size={32} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleZoomOut} style={styles.zoomButton}>
                        <Ionicons name="remove" size={32} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.8,
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    zoomButton: {
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 30,
    },
});

export default ImageViewer;
