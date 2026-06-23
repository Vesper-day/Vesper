// Built-in calendar surface (Chat 053 — parity with the 052-W web calendar).
//
// react-native-calendars drives a month view over instances read from
// /api/v1/calendar-events (recurring series already expanded SERVER-SIDE — see
// lib/calendarEvents.ts). Tapping a day lists that day's events below the month;
// tapping an event (or "New event") opens a create/edit/delete form. All CRUD goes
// through the shared mobile API client + session via lib/calendarEvents — no second
// transport, no client-side RRULE expander, no per-occurrence editing (editing a
// recurring event edits the WHOLE series by id, same limitation as web).
//
// react-native-calendars is pure JS (no custom native module) → runs in Expo Go on
// SDK 52. The Calendar `theme` prop needs raw hex, not NativeWind classes, so the
// token slice below is transcribed verbatim from @vesper/ui tokens.ts.
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import {
  startOfMonth,
  endOfMonth,
  addDays,
  format as formatDate,
  parseISO,
} from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  InvertedRangeError,
  type CalendarEventInstance,
} from '../../lib/calendarEvents';

// Token hexes (verbatim from @vesper/ui tokens.ts) for the Calendar theme, which
// takes raw colors rather than NativeWind classes.
const C = {
  espresso: '#1E1815',
  surface: '#2B221C',
  elevated: '#38291E',
  cream: '#E8DDC9',
  creamMuted: '#A89B85',
  creamFaint: '#756B57',
  bronze: '#B8884A',
  oxblood: '#5C2A2A',
  lineSubtle: '#3D332A',
} as const;

// A small fixed set of recurrence presets — the V1 surface for "fixed weekly events"
// (§3 #25), matching the web EventFormDialog. Custom RRULE authoring is out of scope.
const RRULE_PRESETS: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: 'Does not repeat', value: null },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly (Mon & Wed)', value: 'FREQ=WEEKLY;BYDAY=MO,WE' },
  { label: 'Weekly (Mon–Fri)', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
];

// Fetch a window padded a week past the visible month so day selection near month
// edges still has data (mirrors web windowForDate).
function windowForMonth(monthAnchor: Date): { start: string; end: string } {
  return {
    start: addDays(startOfMonth(monthAnchor), -7).toISOString(),
    end: addDays(endOfMonth(monthAnchor), 7).toISOString(),
  };
}

const dayKey = (iso: string): string => formatDate(new Date(iso), 'yyyy-MM-dd');
const timeLabel = (iso: string): string => formatDate(new Date(iso), 'HH:mm');

// Form draft — local date (yyyy-MM-dd) + time (HH:mm) strings, as the mobile inputs
// edit them. `id: null` => create.
interface Draft {
  id: string | null;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  rrule: string | null;
}

function emptyDraftForDay(day: string): Draft {
  return {
    id: null,
    title: '',
    startDate: day,
    startTime: '09:00',
    endDate: day,
    endTime: '10:00',
    rrule: null,
  };
}

function draftFromInstance(e: CalendarEventInstance): Draft {
  const s = new Date(e.startTime);
  const en = new Date(e.endTime);
  return {
    id: e.id,
    title: e.title,
    startDate: formatDate(s, 'yyyy-MM-dd'),
    startTime: formatDate(s, 'HH:mm'),
    endDate: formatDate(en, 'yyyy-MM-dd'),
    endTime: formatDate(en, 'HH:mm'),
    rrule: e.rrule,
  };
}

// Local date+time strings -> ISO instant (interpreted in device-local time, matching
// web's datetime-local handling). Returns null on an unparseable field.
function toIso(date: string, time: string): string | null {
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function CalendarScreen(): React.JSX.Element {
  const todayKey = formatDate(new Date(), 'yyyy-MM-dd');
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [draft, setDraft] = useState<Draft | null>(null);

  const queryClient = useQueryClient();
  const window = useMemo(() => windowForMonth(monthAnchor), [monthAnchor]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['calendar-events', window.start, window.end],
    queryFn: () => listCalendarEvents(window),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] }).then(() => undefined);

  const events = data ?? [];

  // Dot-mark every day that has at least one event; highlight the selected day.
  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; selected?: boolean; dotColor?: string; selectedColor?: string }> =
      {};
    for (const e of events) {
      const k = dayKey(e.startTime);
      marks[k] = { ...marks[k], marked: true, dotColor: C.bronze };
    }
    marks[selectedDay] = {
      ...marks[selectedDay],
      selected: true,
      selectedColor: C.bronze,
    };
    return marks;
  }, [events, selectedDay]);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => dayKey(e.startTime) === selectedDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDay],
  );

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const startTime = toIso(d.startDate, d.startTime);
      const endTime = toIso(d.endDate, d.endTime);
      if (!d.title.trim()) throw new Error('Please give the event a title.');
      if (!startTime || !endTime) throw new Error('Please set a valid start and end.');
      const payload = { title: d.title.trim(), startTime, endTime, rrule: d.rrule };
      // Inverted-range guard lives in the client module (throws InvertedRangeError).
      return d.id
        ? updateCalendarEvent(d.id, payload)
        : createCalendarEvent(payload);
    },
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: async () => {
      await invalidate();
      setDraft(null);
    },
  });

  const saveError =
    saveMutation.error instanceof InvertedRangeError
      ? 'End time must be after start time.'
      : saveMutation.error instanceof Error
        ? saveMutation.error.message
        : null;

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-cream">Calendar</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              saveMutation.reset();
              setDraft(emptyDraftForDay(selectedDay));
            }}
            className="rounded-md bg-bronze px-3 py-2"
          >
            <Text className="text-sm font-medium text-espresso">New event</Text>
          </Pressable>
        </View>
        <Text className="mb-3 text-sm text-cream-muted">
          Your fixed commitments. Tap a day to see its events.
        </Text>

        <View className="overflow-hidden rounded-lg border border-line-subtle">
          <Calendar
            current={selectedDay}
            markedDates={markedDates}
            onDayPress={(d: DateData) => setSelectedDay(d.dateString)}
            onMonthChange={(d: DateData) => setMonthAnchor(parseISO(d.dateString))}
            enableSwipeMonths
            theme={{
              calendarBackground: C.surface,
              monthTextColor: C.cream,
              dayTextColor: C.cream,
              textSectionTitleColor: C.creamMuted,
              todayTextColor: C.bronze,
              selectedDayBackgroundColor: C.bronze,
              selectedDayTextColor: C.espresso,
              textDisabledColor: C.creamFaint,
              arrowColor: C.bronze,
              dotColor: C.bronze,
            }}
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-base font-medium text-cream">
            {formatDate(parseISO(selectedDay), 'EEEE, MMM d')}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={C.bronze} className="my-6" />
          ) : isError ? (
            <Text className="py-6 text-center text-sm text-oxblood">
              Could not load your calendar.
            </Text>
          ) : dayEvents.length === 0 ? (
            <Text className="py-6 text-center text-sm text-cream-muted">
              Nothing scheduled.
            </Text>
          ) : (
            dayEvents.map((e, i) => (
              <Pressable
                // Recurring instances share the series id, so key by id + start.
                key={`${e.id}-${e.startTime}-${i}`}
                accessibilityRole="button"
                onPress={() => {
                  saveMutation.reset();
                  setDraft(draftFromInstance(e));
                }}
                className="mb-2 flex-row items-center justify-between rounded-md border border-line-subtle bg-surface px-3 py-3"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-medium text-cream">{e.title}</Text>
                  <Text className="text-xs text-cream-muted">
                    {timeLabel(e.startTime)} – {timeLabel(e.endTime)}
                  </Text>
                </View>
                {e.recurring && (
                  <Text className="text-xs text-bronze" accessibilityLabel="Repeats">
                    ↻
                  </Text>
                )}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {draft && (
        <EventForm
          draft={draft}
          saving={saveMutation.isPending}
          deleting={deleteMutation.isPending}
          error={saveError}
          onSave={(d) => saveMutation.mutate(d)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onClose={() => setDraft(null)}
        />
      )}
    </View>
  );
}

interface EventFormProps {
  draft: Draft;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function EventForm({
  draft,
  saving,
  deleting,
  error,
  onSave,
  onDelete,
  onClose,
}: EventFormProps): React.JSX.Element {
  const [title, setTitle] = useState(draft.title);
  const [startDate, setStartDate] = useState(draft.startDate);
  const [startTime, setStartTime] = useState(draft.startTime);
  const [endDate, setEndDate] = useState(draft.endDate);
  const [endTime, setEndTime] = useState(draft.endTime);
  const [rrule, setRrule] = useState<string | null>(draft.rrule);

  const isEdit = draft.id !== null;
  const fieldClass =
    'rounded-md border border-line-subtle bg-elevated px-3 py-2 text-sm text-cream';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-espresso/80 p-4"
        onPress={onClose}
      >
        <Pressable
          // Swallow taps inside the sheet so they don't dismiss it.
          onPress={() => undefined}
          className="w-full max-w-md rounded-xl border border-line-strong bg-surface p-5"
        >
          <Text className="mb-4 text-lg font-semibold text-cream">
            {isEdit ? 'Edit event' : 'New event'}
          </Text>

          <Text className="mb-1 text-xs text-cream-muted">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Team standup"
            placeholderTextColor={C.creamFaint}
            className={`${fieldClass} mb-3`}
          />

          <View className="mb-3 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1 text-xs text-cream-muted">Starts</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.creamFaint}
                autoCapitalize="none"
                className={`${fieldClass} mb-2`}
              />
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={C.creamFaint}
                className={fieldClass}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs text-cream-muted">Ends</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.creamFaint}
                autoCapitalize="none"
                className={`${fieldClass} mb-2`}
              />
              <TextInput
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor={C.creamFaint}
                className={fieldClass}
              />
            </View>
          </View>

          <Text className="mb-1 text-xs text-cream-muted">Repeats</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {RRULE_PRESETS.map((p) => {
              const active = (p.value ?? null) === rrule;
              return (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  onPress={() => setRrule(p.value)}
                  className={`rounded-md border px-3 py-1.5 ${
                    active ? 'border-bronze bg-bronze' : 'border-line-subtle bg-elevated'
                  }`}
                >
                  <Text className={`text-xs ${active ? 'text-espresso' : 'text-cream'}`}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isEdit && rrule !== null && (
            <Text className="mb-3 text-xs text-cream-faint">
              Editing applies to the whole repeating series.
            </Text>
          )}

          {error && <Text className="mb-3 text-sm text-oxblood">{error}</Text>}

          <View className="flex-row items-center justify-between">
            {isEdit ? (
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => draft.id && onDelete(draft.id)}
                className="rounded-md border border-oxblood px-3 py-2"
              >
                <Text className="text-sm text-oxblood">
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View className="flex-row gap-2">
              <Pressable accessibilityRole="button" onPress={onClose} className="px-3 py-2">
                <Text className="text-sm text-cream-muted">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() =>
                  onSave({
                    ...draft,
                    title,
                    startDate,
                    startTime,
                    endDate,
                    endTime,
                    rrule,
                  })
                }
                className="rounded-md bg-bronze px-3 py-2"
              >
                <Text className="text-sm font-medium text-espresso">
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
