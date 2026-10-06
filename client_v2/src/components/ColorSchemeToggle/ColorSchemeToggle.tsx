/**
 * The light/dark choice (SPEC §9.6; §15, DR-101): Light, Dark, or System —
 * follow the operating system, the default (§10, DR-100). The button shows the
 * current choice. Mantine remembers it in this browser's localStorage (shared
 * with other open tabs), where index.html reads it before the bundle loads.
 *
 * Every page offers it: the admin headers carry one, and the app's root puts
 * one at the top right of the pages that have no header
 * (`CornerColorSchemeToggle`).
 */

import {
  ActionIcon,
  Group,
  type MantineColorScheme,
  Menu,
  useMantineColorScheme,
} from '@mantine/core';
import { IconCheck, IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';

const CHOICES: { value: MantineColorScheme; label: string; Icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
  { value: 'auto', label: 'System', Icon: IconDeviceDesktop },
];

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const current = CHOICES.find((choice) => choice.value === colorScheme) ?? CHOICES[2];

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label={`Light or dark mode: ${current.label}`}
          title="Light or dark mode"
        >
          <current.Icon size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {CHOICES.map(({ value, label, Icon }) => (
          <Menu.Item
            key={value}
            leftSection={<Icon size={16} />}
            rightSection={value === colorScheme ? <IconCheck size={16} /> : null}
            onClick={() => setColorScheme(value)}
          >
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * The toggle at the top right of a page without a header, in a row of its own
 * above the page so it never covers the page's content. A page with an app
 * header carries the toggle there, so theme.css hides this one whenever a
 * header is showing. (Hiding it by route wouldn't do: the auth guard shows
 * sign-in, with no header, on the admin's routes.)
 */
export function CornerColorSchemeToggle() {
  return (
    <Group className="camphoric-corner-toggle" justify="flex-end" p={8}>
      <ColorSchemeToggle />
    </Group>
  );
}
