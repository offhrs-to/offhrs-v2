import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const SCRAPE_API = 'https://offhrs.app/api/scrape';

// Hardcoded login check (replace with real auth later)
const ADMIN_EMAIL = 'offhrs.to@gmail.com';
const ADMIN_PASSWORD = 'Am19em26!';

type EventRow = {
  id: number;
  title: string;
  date: string;
  location: string;
  image_url: string | null;
  external_link: string | null;
  category: string | null;
  price?: number | string | null;
};

const defaultForm = {
  title: '',
  date: '',
  location: '',
  image_url: '',
  external_link: '',
  description: '',
  price: '',
  category: 'Other',
};

function formatDateForInput(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return '';
  }
}

export default function AdminScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, location, image_url, external_link, category, price')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents((data as EventRow[]) ?? []);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadEvents();
  }, [authenticated, loadEvents]);

  const handleLogin = () => {
    if (email.trim() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      Alert.alert('Error', 'Invalid email or password');
    }
  };

  const handleMagicFetch = async () => {
    const url = fetchUrl.trim();
    if (!url) {
      Alert.alert('Error', 'Enter a URL');
      return;
    }
    try {
      setFetchLoading(true);
      const res = await fetch(SCRAPE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
      setForm({
        title: data.title ?? '',
        date: data.date ? formatDateForInput(data.date) : '',
        location: data.location ?? '',
        image_url: data.image_url ?? '',
        external_link: data.external_link ?? url,
        description: data.description ?? '',
        price: data.price ?? '',
        category: 'Other',
      });
    } catch (e) {
      Alert.alert('Fetch Error', e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    try {
      setSubmitLoading(true);
      const payload = {
        title: form.title.trim(),
        date: form.date ? new Date(form.date).toISOString() : null,
        location: form.location.trim() || null,
        image_url: form.image_url.trim() || null,
        external_link: form.external_link.trim() || null,
        description: form.description.trim() || null,
        category: form.category || 'Other',
        mode: 'craft',
        price: form.price ? String(form.price).replace(/^\$/, '').trim() : null,
      };
      if (editingId) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
        setForm(defaultForm);
        loadEvents();
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        setForm(defaultForm);
        loadEvents();
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (row: EventRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title ?? '',
      date: row.date ? formatDateForInput(row.date) : '',
      location: row.location ?? '',
      image_url: row.image_url ?? '',
      external_link: row.external_link ?? '',
      description: '',
      price: row.price != null ? String(row.price) : '',
      category: row.category ?? 'Other',
    });
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            loadEvents();
            if (editingId === id) {
              setEditingId(null);
              setForm(defaultForm);
            }
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  if (!authenticated) {
    return (
      <ScrollView className="flex-1 bg-gray-50 p-4" contentContainerStyle={{ paddingTop: 60 }}>
        <Text className="mb-4 text-xl font-bold text-gray-900">Admin Login</Text>
        <TextInput
          className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900"
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900"
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Pressable
          onPress={handleLogin}
          className="rounded-lg bg-gray-900 py-3"
        >
          <Text className="text-center font-medium text-white">Log in</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text className="mb-4 text-xl font-bold text-gray-900">Admin</Text>

      {/* Magic Link Fetcher */}
      <View className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <Text className="mb-2 font-semibold text-gray-900">Fetch from URL</Text>
        <TextInput
          className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Paste event URL..."
          placeholderTextColor="#9ca3af"
          value={fetchUrl}
          onChangeText={setFetchUrl}
          autoCapitalize="none"
        />
        <Pressable
          onPress={handleMagicFetch}
          disabled={fetchLoading}
          className="rounded-lg bg-gray-900 py-2.5"
        >
          <Text className="text-center font-medium text-white">
            {fetchLoading ? 'Fetching...' : 'Fetch'}
          </Text>
        </Pressable>
      </View>

      {/* Add / Edit Event Form */}
      <View className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <Text className="mb-3 font-semibold text-gray-900">
          {editingId ? 'Edit Event' : 'Add Event'}
        </Text>
        <TextInput
          className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Title"
          placeholderTextColor="#9ca3af"
          value={form.title}
          onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
        />
        <TextInput
          className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Date (YYYY-MM-DDTHH:mm)"
          placeholderTextColor="#9ca3af"
          value={form.date}
          onChangeText={(t) => setForm((f) => ({ ...f, date: t }))}
        />
        <TextInput
          className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Location"
          placeholderTextColor="#9ca3af"
          value={form.location}
          onChangeText={(t) => setForm((f) => ({ ...f, location: t }))}
        />
        <TextInput
          className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Image URL"
          placeholderTextColor="#9ca3af"
          value={form.image_url}
          onChangeText={(t) => setForm((f) => ({ ...f, image_url: t }))}
          autoCapitalize="none"
        />
        <TextInput
          className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
          placeholder="Link"
          placeholderTextColor="#9ca3af"
          value={form.external_link}
          onChangeText={(t) => setForm((f) => ({ ...f, external_link: t }))}
          autoCapitalize="none"
        />
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleSubmit}
            disabled={submitLoading}
            className="flex-1 rounded-lg bg-gray-900 py-2.5"
          >
            <Text className="text-center font-medium text-white">
              {submitLoading ? 'Saving...' : editingId ? 'Update' : 'Add Event'}
            </Text>
          </Pressable>
          {editingId && (
            <Pressable onPress={cancelEdit} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5">
              <Text className="font-medium text-gray-700">Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Events list */}
      <View className="rounded-lg border border-gray-200 bg-white p-4">
        <Text className="mb-3 font-semibold text-gray-900">Events</Text>
        {loading ? (
          <Text className="py-4 text-center text-gray-500">Loading...</Text>
        ) : events.length === 0 ? (
          <Text className="py-4 text-center text-gray-500">No events</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {events.map((row) => (
              <View
                key={row.id}
                className="flex-row flex-wrap items-center justify-between rounded border border-gray-100 bg-gray-50 p-3"
              >
                <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
                  {row.title}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleEdit(row)}
                    className="rounded bg-gray-700 px-3 py-1.5"
                  >
                    <Text className="text-xs font-medium text-white">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(row.id)}
                    className="rounded bg-red-600 px-3 py-1.5"
                  >
                    <Text className="text-xs font-medium text-white">Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
