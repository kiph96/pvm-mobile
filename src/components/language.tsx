import React from 'react';

import { LANGUAGES, useI18n } from '@/i18n';
import { Chip, Row } from './ui';

/** Tiếng Việt / English switch. */
export function LanguagePicker() {
  const { lang, setLang } = useI18n();
  return (
    <Row gap={8} wrap>
      {LANGUAGES.map((l) => (
        <Chip key={l.value} label={`${l.flag} ${l.label}`} selected={lang === l.value} onPress={() => setLang(l.value)} />
      ))}
    </Row>
  );
}
