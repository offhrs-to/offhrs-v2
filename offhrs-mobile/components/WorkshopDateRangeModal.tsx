import WorkshopFilterBottomSheet from '@/components/WorkshopFilterBottomSheet';
import { DesignColors } from '@/constants/design-template';
import { getTorontoYmd } from '@/lib/workshop-calendar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialStart: string;
  initialEnd: string;
  onApply: (start: string | null, end: string | null) => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function formatRangeLabel(start: string | null, end: string | null): string {
  if (!start && !end) return 'Tap a start date, then an end date. Same day = one date.';
  if (start && !end) return `Start: ${start} — tap an end date (or Apply for this day only)`;
  if (start && end && start === end) return `Selected: ${start}`;
  if (start && end) return `${start} → ${end}`;
  return '';
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function firstWeekday(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

function monthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Full-month calendar for picking a single day or inclusive date range.
 * First tap sets start; second tap sets end (auto-ordered). Apply with only
 * start selected treats that day as a single-day filter.
 */
function WorkshopDateRangeModal({
  visible,
  onClose,
  initialStart,
  initialEnd,
  onApply,
}: Props) {
  const todayYmd = getTorontoYmd();
  const todayParsed = parseYmd(todayYmd) ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth(),
    d: new Date().getDate(),
  };

  const [viewYear, setViewYear] = useState(todayParsed.y);
  const [viewMonth, setViewMonth] = useState(todayParsed.m);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const s = initialStart.trim().slice(0, 10);
    const e = initialEnd.trim().slice(0, 10);
    const startOk = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    const endOk = /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null;
    setRangeStart(startOk);
    setRangeEnd(endOk);
    const anchor = parseYmd(startOk ?? endOk ?? todayYmd);
    if (anchor) {
      setViewYear(anchor.y);
      setViewMonth(anchor.m);
    }
  }, [visible, initialStart, initialEnd, todayYmd]);

  const cells = useMemo(() => {
    const totalDays = daysInMonth(viewYear, viewMonth);
    const offset = firstWeekday(viewYear, viewMonth);
    const out: ({ ymd: string; day: number } | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let day = 1; day <= totalDays; day++) {
      out.push({ ymd: toYmd(viewYear, viewMonth, day), day });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const onDayPress = (ymd: string) => {
    // New range: no start, or both ends already set → start fresh
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(ymd);
      setRangeEnd(null);
      return;
    }
    // Second tap: complete range (order automatically)
    if (ymd < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(ymd);
    } else {
      setRangeEnd(ymd);
    }
  };

  const isInRange = (ymd: string): boolean => {
    if (!rangeStart || !rangeEnd) return false;
    return ymd >= rangeStart && ymd <= rangeEnd;
  };

  const isEndpoint = (ymd: string): boolean => ymd === rangeStart || ymd === rangeEnd;

  return (
    <WorkshopFilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Select dates"
      subtitle={formatRangeLabel(rangeStart, rangeEnd)}
      maxHeightRatio={0.82}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => {
              setRangeStart(null);
              setRangeEnd(null);
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
              if (!rangeStart) {
                onApply(null, null);
                onClose();
                return;
              }
              // Single day if only start chosen
              const end = rangeEnd ?? rangeStart;
              onApply(rangeStart, end);
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
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingHorizontal: 4,
          }}
        >
          <Pressable
            onPress={goPrevMonth}
            hitSlop={10}
            accessibilityLabel="Previous month"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: DesignColors.inputBg,
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={DesignColors.primary} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '700', color: DesignColors.charcoal }}>
            {monthTitle(viewYear, viewMonth)}
          </Text>
          <Pressable
            onPress={goNextMonth}
            hitSlop={10}
            accessibilityLabel="Next month"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: DesignColors.inputBg,
            }}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={DesignColors.primary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {WEEKDAYS.map((w) => (
            <View key={w} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: DesignColors.mediumGray }}>{w}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 2 }}>
          {Array.from({ length: cells.length / 7 }, (_, week) => (
            <View key={`week-${week}`} style={{ flexDirection: 'row' }}>
              {cells.slice(week * 7, week * 7 + 7).map((cell, dayIdx) => {
                if (!cell) {
                  return <View key={`empty-${week}-${dayIdx}`} style={{ flex: 1, aspectRatio: 1 }} />;
                }
                const endpoint = isEndpoint(cell.ymd);
                const inRange = isInRange(cell.ymd);
                const isToday = cell.ymd === todayYmd;
                const selectingStartOnly = rangeStart === cell.ymd && !rangeEnd;

                return (
                  <Pressable
                    key={cell.ymd}
                    onPress={() => onDayPress(cell.ymd)}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: endpoint || selectingStartOnly
                        ? DesignColors.primary
                        : inRange
                          ? DesignColors.heroBg
                          : 'transparent',
                      borderRadius: endpoint || selectingStartOnly ? 9999 : inRange ? 8 : 9999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: endpoint || selectingStartOnly || isToday ? '700' : '500',
                        color:
                          endpoint || selectingStartOnly
                            ? '#FFF'
                            : isToday
                              ? DesignColors.primary
                              : DesignColors.charcoal,
                      }}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </WorkshopFilterBottomSheet>
  );
}

export default memo(WorkshopDateRangeModal);
