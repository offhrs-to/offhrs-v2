import { DesignColors } from '@/constants/design-template';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialStart: string;
  initialEnd: string;
  onApply: (start: string | null, end: string | null) => void;
};

export default function WorkshopDateRangeModal({
  visible,
  onClose,
  initialStart,
  initialEnd,
  onApply,
}: Props) {
  const [dateInputStart, setDateInputStart] = useState(initialStart);
  const [dateInputEnd, setDateInputEnd] = useState(initialEnd);
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);
  const [pickerDate, setPickerDate] = useState(() => new Date());

  useEffect(() => {
    if (!visible) return;
    setDateInputStart(initialStart);
    setDateInputEnd(initialEnd);
    setActiveDateField(null);
  }, [visible, initialStart, initialEnd]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: '#FFF',
            borderRadius: 20,
            padding: 24,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 16 }}>
            Filter by date range
          </Text>
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>From</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginBottom: 16 }}>
              {createElement('input', {
                type: 'date',
                value: dateInputStart,
                onChange: (e: { target: { value: string } }) => setDateInputStart(e.target.value || ''),
                style: {
                  width: '100%',
                  height: 40,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  backgroundColor: DesignColors.inputBg,
                  fontSize: 14,
                  color: DesignColors.charcoal,
                },
              })}
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  const d = dateInputStart.trim().slice(0, 10);
                  setPickerDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date());
                  setActiveDateField('from');
                }}
                style={{
                  backgroundColor: DesignColors.inputBg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 16,
                  justifyContent: 'center',
                  minHeight: 40,
                }}
              >
                <Text style={{ fontSize: 14, color: dateInputStart ? DesignColors.charcoal : DesignColors.mediumGray }}>
                  {dateInputStart || 'YYYY-MM-DD'}
                </Text>
              </Pressable>
              {activeDateField === 'from' && (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="default"
                  onChange={(_, selectedDate) => {
                    setActiveDateField(null);
                    if (selectedDate) {
                      const y = selectedDate.getFullYear();
                      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      setDateInputStart(`${y}-${m}-${day}`);
                    }
                  }}
                />
              )}
            </>
          )}
          <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>To</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginBottom: 20 }}>
              {createElement('input', {
                type: 'date',
                value: dateInputEnd,
                onChange: (e: { target: { value: string } }) => setDateInputEnd(e.target.value || ''),
                style: {
                  width: '100%',
                  height: 40,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  backgroundColor: DesignColors.inputBg,
                  fontSize: 14,
                  color: DesignColors.charcoal,
                },
              })}
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  const d = dateInputEnd.trim().slice(0, 10);
                  setPickerDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date());
                  setActiveDateField('to');
                }}
                style={{
                  backgroundColor: DesignColors.inputBg,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: activeDateField === 'to' ? 8 : 20,
                  justifyContent: 'center',
                  minHeight: 40,
                }}
              >
                <Text style={{ fontSize: 14, color: dateInputEnd ? DesignColors.charcoal : DesignColors.mediumGray }}>
                  {dateInputEnd || 'YYYY-MM-DD'}
                </Text>
              </Pressable>
              {activeDateField === 'to' && (
                <View style={{ marginBottom: 24 }}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setActiveDateField(null);
                      if (selectedDate) {
                        const y = selectedDate.getFullYear();
                        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setDateInputEnd(`${y}-${m}-${day}`);
                      }
                    }}
                  />
                </View>
              )}
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable
              onPress={() => {
                setDateInputStart('');
                setDateInputEnd('');
                onApply(null, null);
                onClose();
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.sageGreen }}>Clear dates</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const from = dateInputStart.trim() ? dateInputStart.trim().slice(0, 10) : null;
                const to = dateInputEnd.trim() ? dateInputEnd.trim().slice(0, 10) : null;
                const s =
                  from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;
                const e =
                  to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null;
                onApply(s, e);
                onClose();
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
