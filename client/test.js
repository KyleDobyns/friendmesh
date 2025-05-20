import { supabase } from './supabaseClient';

const testUpload = async () => {
  const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
  const { error } = await supabase.storage
    .from('avatars')
    .upload('test/hello.txt', file, { upsert: true });

  if (error) {
    console.error('❌ Upload failed:', error);
  } else {
    console.log('✅ Upload succeeded');
  }
};

testUpload();
