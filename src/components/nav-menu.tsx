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
             <AccordionTrigger
              className={cn(
                sidebarMenuButtonVariants({variant: "ghost"}),
                "w-full justify-between",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <item.icon />
                <span className={cn("text-left", state === 'collapsed' && "hidden")}>{item.label}</span>
              </div>
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

// Duplicated from sidebar.tsx to avoid circular dependency
const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        ghost: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
