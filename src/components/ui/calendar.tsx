"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"
import { ptBR } from 'date-fns/locale';
import { format, parse } from 'date-fns';

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  value: controlledValue,
  onValueChange,
  ...props
}: CalendarProps) {
  const [inputValue, setInputValue] = React.useState(controlledValue ? format(new Date(controlledValue), 'dd/MM/yyyy') : "");
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(controlledValue ? new Date(controlledValue) : undefined);

  React.useEffect(() => {
    if (controlledValue) {
        const newDate = new Date(controlledValue);
        if (!isNaN(newDate.getTime())) {
            setSelectedDate(newDate);
            setInputValue(format(newDate, 'dd/MM/yyyy'));
        }
    } else {
        setSelectedDate(undefined);
        setInputValue("");
    }
  }, [controlledValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value.length === 10) {
      const parsedDate = parse(value, 'dd/MM/yyyy', new Date());
      if (!isNaN(parsedDate.getTime())) {
        setSelectedDate(parsedDate);
        if (onValueChange && props.onSelect) {
            props.onSelect(parsedDate, parsedDate, {} as any, e);
        }
      }
    }
  };

  const handleDaySelect = (date: Date | undefined, selectedDay: Date, modifiers: any, e: any) => {
    if(date){
        setSelectedDate(date);
        setInputValue(format(date, 'dd/MM/yyyy'));
        if (props.onSelect) {
            props.onSelect(date, selectedDay, modifiers, e);
        }
    }
  };
  
  function CustomCaption(props: DropdownProps) {
    const { fromDate, toDate, fromMonth, toMonth, fromYear, toYear } = props;
    const [currentMonth, setCurrentMonth] = React.useState(props.displayMonth);

    const handleMonthChange = (month: Date) => {
        setCurrentMonth(month);
        props.onMonthChange?.(month);
    };

    const handleYearChange = (year: number) => {
        const newMonth = new Date(currentMonth);
        newMonth.setFullYear(year);
        handleMonthChange(newMonth);
    };

    const years: number[] = [];
    const startYear = fromYear || new Date().getFullYear() - 100;
    const endYear = toYear || new Date().getFullYear() + 10;
    for (let i = startYear; i <= endYear; i++) {
        years.push(i);
    }
    
    return (
        <div className="flex justify-between items-center px-2 mb-2">
            <Select
                value={currentMonth.getMonth().toString()}
                onValueChange={(value) => {
                    const newMonth = new Date(currentMonth);
                    newMonth.setMonth(parseInt(value, 10));
                    handleMonthChange(newMonth);
                }}
            >
                <SelectTrigger className="w-auto text-sm focus:ring-0 focus:ring-offset-0 border-0 h-auto p-0 m-0">
                  <SelectValue placeholder={format(currentMonth, 'MMMM', { locale: ptBR })} />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                            {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={currentMonth.getFullYear().toString()}
                onValueChange={(value) => handleYearChange(parseInt(value, 10))}
            >
                <SelectTrigger className="w-auto text-sm focus:ring-0 focus:ring-offset-0 border-0 h-auto p-0 m-0">
                    <SelectValue placeholder={currentMonth.getFullYear()} />
                </SelectTrigger>
                <SelectContent>
                    {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

  return (
    <div>
        <Input
            type="text"
            placeholder="dd/mm/aaaa"
            value={inputValue}
            onChange={handleInputChange}
            className="mb-2"
        />
        <DayPicker
          showOutsideDays={showOutsideDays}
          className={cn("p-0", className)}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium hidden",
            caption_dropdowns: "flex justify-between w-full",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell:
              "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            IconLeft: ({ className, ...props }) => (
              <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
            ),
            IconRight: ({ className, ...props }) => (
              <ChevronRight className={cn("h-4 w-4", className)} {...props} />
            ),
            Caption: (props) => <CustomCaption {...props} />,
          }}
          locale={ptBR}
          selected={selectedDate}
          onSelect={handleDaySelect}
          {...props}
        />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
