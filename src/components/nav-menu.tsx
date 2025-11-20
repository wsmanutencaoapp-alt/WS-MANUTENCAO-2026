'use client';

import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

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
    <TooltipProvider>
      <Accordion type="multiple" className="w-full flex flex-col items-center gap-1">
        {items.map((item) => {
          const isActive = item.subItems
            ? pathname.startsWith(item.href)
            : pathname === item.href;

          if (!item.subItems || item.subItems.length === 0) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                      isActive && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <AccordionItem value={item.href} key={item.href} className="border-b-0 w-full">
               <Tooltip>
                <TooltipTrigger asChild>
                    <AccordionTrigger 
                        showChevron={false} 
                        className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8 hover:no-underline',
                            isActive && 'bg-accent text-accent-foreground'
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                    </AccordionTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
              <AccordionContent className="pt-2 flex flex-col gap-1 items-center">
                 {item.subItems.map((subItem) => (
                   <Tooltip key={subItem.href}>
                        <TooltipTrigger asChild>
                            <Link
                                href={subItem.href}
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground',
                                    pathname === subItem.href && 'bg-accent/70 text-accent-foreground'
                                )}
                            >
                               {/* Mostra as duas primeiras letras do label */}
                               {subItem.label.substring(0, 2)}
                               <span className="sr-only">{subItem.label}</span>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{subItem.label}</TooltipContent>
                   </Tooltip>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </TooltipProvider>
  );
}
