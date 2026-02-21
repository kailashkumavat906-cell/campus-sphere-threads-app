import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

// Reusable Option Modal Component
function OptionModal({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  colors: any;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionItem,
                  { borderBottomColor: colors.border },
                  option === selectedValue && [
                    styles.selectedOption,
                    { backgroundColor: 'rgba(0, 122, 255, 0.1)' },
                  ],
                ]}
                onPress={() => onSelect(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    option === selectedValue && { color: '#007AFF' },
                  ]}
                >
                  {option}
                </Text>
                {option === selectedValue && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: colors.secondary },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '60%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedOption: {
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optionText: {
    fontSize: 16,
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OptionModal;
