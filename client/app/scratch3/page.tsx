"use client";

import { Dropdown } from "@heroui/react";
import { ShieldCheck } from "lucide-react";

export default function Scratch3Page() {
  return (
    <div className="p-10">
      <Dropdown>
        <Dropdown.Trigger aria-label="scratch3 menu">Open</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={() => {}}>
            <Dropdown.Section>
              <div className="px-2.5 py-2">
                <ShieldCheck className="size-3" />
                owner
              </div>
            </Dropdown.Section>
            <Dropdown.Item id="a">Alpha</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
