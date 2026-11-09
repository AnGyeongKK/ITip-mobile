// 폴더 생성·이름 변경 입력 (폴더 이름 규칙: src/api/archive.ts의 validateFolderName)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, newIdempotencyKey } from '../api/client';
import { FOLDER_NAME_MAX, displayFolderName, validateFolderName } from '../api/archive';
import type { Folder } from '../api/types';
import { useCreateFolder, useFolders, useRenameFolder } from '../hooks/queries';
import { colors, font, radius, space } from '../theme/tokens';
import { Button } from './ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 있으면 이름 변경, 없으면 새 폴더 */
  editing?: Folder | null;
  onDone?: (folder: Folder) => void;
};

export function FolderNameModal({ visible, onClose, editing, onDone }: Props) {
  const { data, refetch } = useFolders();
  const create = useCreateFolder();
  const rename = useRenameFolder();
  const [name, setName] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  // 같은 '만들기' 동작의 재전송에는 같은 키를 쓰고, 모달을 새로 열 때만 새 키
  const keyRef = useRef(newIdempotencyKey());

  useEffect(() => {
    if (visible) {
      setName(editing ? displayFolderName(editing.name) : '');
      setServerError(null);
      keyRef.current = newIdempotencyKey();
      refetch();
    }
  }, [visible, editing, refetch]);

  const localError = useMemo(() => (name ? validateFolderName(name, data?.items ?? [], editing?.folderId) : null), [name, data, editing]);
  const busy = create.isPending || rename.isPending;

  const submit = async () => {
    if (validateFolderName(name, data?.items ?? [], editing?.folderId)) return;
    setServerError(null);
    try {
      const f = editing
        ? await rename.mutateAsync({ folderId: editing.folderId, name })
        : await create.mutateAsync({ name, idempotencyKey: keyRef.current });
      onDone?.(f);
      onClose();
    } catch (e) {
      // 실패해도 입력한 이름은 유지해서 다시 시도할 수 있게 한다 (ARCHIVE-06)
      setServerError(e instanceof ApiError ? e.message : '저장하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const error = serverError ?? localError;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={font.h2}>{editing ? '폴더 이름 바꾸기' : '새 폴더 만들기'}</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={(t) => { setName(t); setServerError(null); }}
            placeholder="예: AI 공부"
            placeholderTextColor={colors.textMuted}
            maxLength={FOLDER_NAME_MAX + 5}
            style={[styles.input, !!error && { borderColor: colors.danger }]}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.metaRow}>
            <Text style={[font.caption, { color: error ? colors.danger : colors.textMuted, flex: 1 }]}>{error ?? '띄어쓰기를 쓸 수 있어요.'}</Text>
            <Text style={font.caption}>{name.trim().length}/{FOLDER_NAME_MAX}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: space.lg }}>
            <Button title="취소" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: space.sm }} />
            <Button title={editing ? '저장' : '만들기'} onPress={submit} loading={busy} disabled={!name.trim() || !!localError} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.xl },
  sheet: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space.xl },
  input: { marginTop: space.lg, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 15, color: colors.text },
  metaRow: { flexDirection: 'row', marginTop: space.xs },
});
