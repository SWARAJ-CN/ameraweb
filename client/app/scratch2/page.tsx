"use client";

import { Dropdown } from "@heroui/react";

export default function Scratch2Page() {
  return (
    <div className="p-10">
      <Dropdown>
        <Dropdown.Trigger aria-label="scratch2 menu">Open</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={() => {}}>
            <Dropdown.Section>
              <div className="px-2.5 py-2">Plain text only</div>
            </Dropdown.Section>
            <Dropdown.Item id="a">Alpha</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
