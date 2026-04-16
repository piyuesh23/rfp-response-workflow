"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface AccuracyTabDef {
  value: string;
  label: string;
  count: number;
  content: React.ReactNode;
}

export function AccuracyTabs({
  tabs,
  value,
  onValueChange,
}: {
  tabs: AccuracyTabDef[];
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const isControlled = value !== undefined && onValueChange !== undefined;
  return (
    <Tabs
      {...(isControlled
        ? { value, onValueChange }
        : { defaultValue: tabs[0]?.value ?? "gaps" })}
      className="w-full gap-4"
    >
      <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 bg-transparent p-0" variant="line">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="gap-2 data-active:bg-muted"
          >
            <span>{t.label}</span>
            <Badge
              variant={t.count === 0 ? "outline" : "destructive"}
              className="tabular-nums"
            >
              {t.count}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="pt-2">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
