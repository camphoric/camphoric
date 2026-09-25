/**
 * Ladle story for the HtmlFrame (SPEC §9.6): template HTML shown sandboxed,
 * sized to its content. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';

import { HtmlFrame } from './HtmlFrame';

const REPORT = `<style>table { border-collapse: collapse } td, th { border: 1px solid #999; padding: 4px 8px }</style>
<h2>Cabin roster</h2>
<table><tr><th>Cabin</th><th>Campers</th></tr>
<tr><td>Cabin A</td><td>Pat, Sam</td></tr>
<tr><td>Tent 1</td><td>Lee</td></tr></table>
<script>document.body.innerHTML = 'scripts must not run'</script>`;

export const Report: Story = () => (
  <Stack maw={720} p="md">
    <HtmlFrame title="Report" html={REPORT} />
  </Stack>
);
