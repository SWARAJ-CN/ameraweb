"use client";

import { Dropdown } from "@heroui/react";
import { LogOut, ShieldCheck } from "lucide-react";

export default function ScratchPage() {
  return (
    <div className="p-10">
      <Dropdown>
        <Dropdown.Trigger aria-label="scratch menu">Open</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={() => {}}>
            <Dropdown.Item id="logout" variant="danger">
              <LogOut className="size-4" />
              Sign out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
