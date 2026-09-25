import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';

import { hapticSelection, hapticTap } from '../utils/haptics';

interface ItemNotesModalProps {
  visible: boolean;
  itemName: string;
  currentNotes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

const QUICK_NOTES = [
  'No Spice', 'Extra Spicy', 'Less Oil', 'No Onion', 'No Garlic',
  'Extra Gravy', 'Well Done', 'Less Salt', 'Jain', 'No Dairy',
];

export default function ItemNotesModal({
  visible, itemName, currentNotes, onSave, onClose,
}: ItemNotesModalProps) {
  const [notes, setNotes] = useState(currentNotes);

  useEffect(() => {
    if (visible) setNotes(currentNotes);
  }, [visible, currentNotes]);

  const toggleQuick = (note: string) => {
    hapticSelection();
    setNotes(prev => {
      const tags = prev.split(',').map(s => s.trim()).filter(Boolean);
      const idx = tags.findIndex(t => t === note);
      if (idx >= 0) {
        tags.splice(idx, 1);
      } else {
        tags.push(note);
      }
      return tags.join(', ');
    });
  };

  const isTagActive = (tag: string) =>
    notes.split(',').map(s => s.trim()).includes(tag);

  const handleSave = () => {
    hapticTap();
    onSave(notes.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Special Instructions</Text>
          <Text style={styles.itemName}>{itemName}</Text>

          {/* Quick Tags */}
          <View style={styles.tagsWrap}>
            {QUICK_NOTES.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, isTagActive(tag) && styles.tagActive]}
                onPress={() => toggleQuick(tag)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tagText, isTagActive(tag) && styles.tagTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Free text */}
          <TextInput
            style={styles.input}
            placeholder="Or type a custom note..."
            placeholderTextColor="#52525B"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          <Text style={styles.charCount}>{notes.length}/200</Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111113',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 5, backgroundColor: '#3F3F46',
    borderRadius: 3, alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  itemName: { fontSize: 14, color: '#D4AF37', fontWeight: '700', marginBottom: 20 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#18181B', borderWidth: 1, borderColor: '#3F3F46',
  },
  tagActive: { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: '#D4AF37' },
  tagText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  tagTextActive: { color: '#D4AF37', fontWeight: '800' },
  input: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  charCount: { color: '#3F3F46', fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 6, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#A1A1AA', fontSize: 15, fontWeight: '800' },
  saveBtn: { flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: '#D4AF37', alignItems: 'center' },
  saveBtnText: { color: '#09090B', fontSize: 15, fontWeight: '900' },
});
