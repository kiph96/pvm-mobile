import { useQuery } from '@tanstack/react-query';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAction, useToast } from '@/components/toast';
import { Avatar, Button, Card, ErrorState, Field, Loading, Row, Screen, Section, Txt, confirm } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useOrgKey } from '@/state/queries';
import { useApi, useSession } from '@/state/session';
import { errorMessage } from '@/utils/format';

/** Owner/admin: the Business name, description and logo that staff see in their Business list. */
export default function BusinessProfile() {
  const api = useApi();
  const org = useOrgKey();
  const { t } = useI18n();
  const toast = useToast();
  const { session, chooseWorkspace } = useSession();
  const [run, busy] = useAction();
  const q = useQuery({ queryKey: ['organization', org], queryFn: api.organization });
  const o = q.data;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (o) {
      setName(o.name);
      setDescription(o.description ?? '');
    }
  }, [o]);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error || !o) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const logo = api.logoUrl(o.id, o.logoVersion);
  const changed = name.trim() !== o.name || (description.trim() || null) !== (o.description ?? null);

  // the header shows the Business name from the session: keep it in step with a rename
  const syncName = async (newName: string) => {
    if (session?.workspace && session.workspace.name !== newName) await chooseWorkspace({ ...session.workspace, name: newName });
  };

  const pickLogo = async () => {
    setPicking(true);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (picked.canceled || !picked.assets?.[0]) return;
      // square, 512 px, JPEG: a few dozen KB, well under the server's 1 MB limit
      const img = await manipulateAsync(picked.assets[0].uri, [{ resize: { width: 512, height: 512 } }],
        { compress: 0.82, format: SaveFormat.JPEG, base64: true });
      if (!img.base64) throw new Error(t('business.readFailed'));
      await run('logo', () => api.uploadLogo({ contentType: 'image/jpeg', data: img.base64! }), t('business.logoSaved'));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPicking(false);
    }
  };

  return (
    <Screen onRefresh={q.refetch} refreshing={q.isRefetching}>
      <Section title={t('business.logo')} style={{ marginTop: 12 }}>
        <Card style={{ alignItems: 'center', gap: 14, paddingVertical: 20 }}>
          <Avatar name={o.name} uri={logo} size={104} square />
          <Txt variant="small" muted center>{t('business.logoHint')}</Txt>
          <Row gap={8}>
            <Button small icon="image-outline" title={logo ? t('business.changeLogo') : t('business.addLogo')}
              loading={picking || busy === 'logo'} onPress={pickLogo} />
            {logo ? (
              <Button small variant="ghost" icon="trash-outline" title={t('business.removeLogo')} loading={busy === 'rmlogo'}
                onPress={async () => {
                  if (await confirm(t('business.removeLogoTitle'), t('business.removeLogoMsg'), t('business.removeLogo'), true)) {
                    run('rmlogo', () => api.removeLogo(), t('business.logoRemoved'));
                  }
                }} />
            ) : null}
          </Row>
        </Card>
      </Section>

      <Section title={t('business.details')}>
        <Card style={{ gap: 14 }}>
          <Field label={t('workspace.businessName')} value={name} onChangeText={setName} maxLength={200} />
          <View>
            <Field label={t('business.description')} value={description} onChangeText={setDescription} maxLength={500} multiline
              placeholder={t('business.descriptionPlaceholder')} style={{ minHeight: 88, textAlignVertical: 'top' }} />
            <Txt variant="tiny" muted style={{ alignSelf: 'flex-end', marginTop: 4 }}>{description.length}/500</Txt>
          </View>
          <Txt variant="small" muted>{t('business.visibleTo')}</Txt>
          <Button title={t('common.save')} icon="checkmark" full disabled={!name.trim() || !changed} loading={busy === 'save'}
            onPress={async () => {
              const r = await run('save', () => api.updateOrganization({ name: name.trim(), description: description.trim() || null }),
                t('business.saved'));
              if (r) await syncName(r.name);
            }} />
        </Card>
      </Section>
    </Screen>
  );
}
