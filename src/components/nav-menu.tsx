"use client";

import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';


export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  subItems?: {
    href: string;
    label: string;
  }[];
}

interface NavMenuProps {
  items: NavItem[];
  pathname: string;
  isMobile?: boolean;
}

export function NavMenu({ items, pathname, isMobile = false }: NavMenuProps) {
    const { state } = useSidebar();
    
    if (isMobile) {
    return (
      <Accordion type="multiple" className="w-full">
        {items.map((item) => {
          const isActive = item.subItems
            ? pathname.startsWith(item.href)
            : pathname === item.href;
          
          if (!item.subItems || item.subItems.length === 0) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground',
                  isActive && 'text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          }

          return (
            <AccordionItem value={item.href} key={item.href} className="border-b-0">
              <AccordionTrigger
                className={cn(
                  'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground hover:no-underline',
                  isActive && 'text-foreground'
                )}
              >
                <div className="flex items-center gap-4">
                    <item.icon className="h-5 w-5" />
                    {item.label}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8">
                <div className="flex flex-col gap-4 mt-2">
                    {item.subItems.map((subItem) => (
                        <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                                'text-muted-foreground hover:text-foreground',
                                pathname === subItem.href && 'text-foreground font-semibold'
                            )}
                        >
                            {subItem.label}
                        </Link>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  }

  // Desktop Version uses Accordion now.
  return (
    <Accordion type="multiple" className="w-full space-y-1">
    {items.map((item) => {
        const isActive = item.subItems ? pathname.startsWith(item.href) : pathname === item.href;

        if (!item.subItems || item.subItems.length === 0) {
        return (
            <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
                <SidebarMenuButton 
                    isActive={isActive}
                    tooltip={{children: item.label}}
                >
                <item.icon />
                <span className={cn(state === 'collapsed' && "hidden")}>{item.label}</span>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
        );
        }

        return (
        <AccordionItem value={item.href} key={item.href} className="border-b-0">
            <AccordionTrigger>
                <SidebarMenuButton 
                    isActive={isActive}
                    className="[&[data-state=open]>svg:last-child]:-rotate-90 w-full"
                    tooltip={{children: item.label}}
                >
                    <item.icon />
                    <span className={cn("flex-1 text-left", state === 'collapsed' && "hidden")}>{item.label}</span>
                </SidebarMenuButton>
            </AccordionTrigger>
            <AccordionContent asChild>
                <div className={cn("pt-1 pl-6 space-y-1", state === 'collapsed' && "hidden")}>
                    {item.subItems.map((subItem) => (
                    <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={cn(
                        'block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                        pathname === subItem.href && 'bg-accent text-accent-foreground font-medium'
                        )}
                    >
                        {subItem.label}
                    </Link>
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
        );
    })}
    </Accordion>
  );
}
