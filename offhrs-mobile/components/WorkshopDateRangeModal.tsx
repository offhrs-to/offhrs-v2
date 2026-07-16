import { DesignColors } from '@/constants/design-template';
import WorkshopFilterBottomSheet from '@/components/WorkshopFilterBottomSheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

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

  const fieldButton = (
    value: string,
    placeholder: string,
    field: 'from' | 'to'
  ) => (
    <Pressable
      onPress={() => {
        const d = value.trim().slice(0, 10);
        setPickerDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date());
        setActiveDateField(field);
      }}
      style={{
        backgroundColor: DesignColors.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        justifyContent: 'center',
        minHeight: 40,
      }}
    >
      <Text style={{ fontSize: 14, color: value ? DesignColors.charcoal : DesignColors.mediumGray }}>
        {value || placeholder}
      </Text>
    </Pressable>
  );

  return (
    <WorkshopFilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Select dates"
      subtitle="Pick a single day (same From and To) or a date range."
      maxHeightRatio={0.7}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
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
            <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.sageGreen }}>Clear</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const from = dateInputStart.trim() ? dateInputStart.trim().slice(0, 10) : null;
              const to = dateInputEnd.trim() ? dateInputEnd.trim().slice(0, 10) : null;
              const s = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;
              const e = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null;
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
      }
    >
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
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
            {fieldButton(dateInputStart, 'YYYY-MM-DD', 'from')}
            {activeDateField === 'from' && (
              <View style={{ marginBottom: 12 }}>
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
              </View>
            )}
          </>
        )}
        <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 6 }}>To</Text>
        {Platform.OS === 'web' ? (
          <View style={{ marginBottom: 8 }}>
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
            {fieldButton(dateInputEnd, 'YYYY-MM-DD', 'to')}
            {activeDateField === 'to' && (
              <View style={{ marginBottom: 8 }}>
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
      </View>
    </WorkshopFilterBottomSheet>
  );
}
