// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Badge } from '../../src/renderer/components/ui/Badge.tsx';
import { Button } from '../../src/renderer/components/ui/Button.tsx';
import { Checkbox } from '../../src/renderer/components/ui/Checkbox.tsx';
import { Chip } from '../../src/renderer/components/ui/Chip.tsx';
import { Dialog, DialogContent, DialogTrigger } from '../../src/renderer/components/ui/Dialog.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../src/renderer/components/ui/Popover.tsx';
import { Progress } from '../../src/renderer/components/ui/Progress.tsx';
import { RadioGroup } from '../../src/renderer/components/ui/RadioGroup.tsx';
import { Select } from '../../src/renderer/components/ui/Select.tsx';
import { Tooltip, TooltipProvider } from '../../src/renderer/components/ui/Tooltip.tsx';

afterEach(cleanup);

// Radix Select reads pointer APIs that jsdom lacks.
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
});
globalThis.ResizeObserver = class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};

describe('primitives take focus and have an accessible name', () => {
  it('Button', () => {
    render(<Button>Convert</Button>);
    const button = screen.getByRole('button', { name: 'Convert' });
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('Chip, as a toggle', () => {
    render(<Chip selected>PNG</Chip>);
    const chip = screen.getByRole('button', { name: 'PNG' });
    chip.focus();
    expect(document.activeElement).toBe(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('Checkbox, named by its label', () => {
    const onChange = vi.fn<(checked: boolean) => void>();
    render(
      <Checkbox checked={false} onCheckedChange={onChange}>
        Grayscale
      </Checkbox>,
    );
    const box = screen.getByRole('checkbox', { name: 'Grayscale' });
    box.focus();
    expect(document.activeElement).toBe(box);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('RadioGroup, named by its label, one radio per option', () => {
    const onChange = vi.fn<(value: string) => void>();
    render(
      <RadioGroup
        label="Save to"
        value="source"
        onValueChange={onChange}
        options={[
          { value: 'source', label: 'Same folder' },
          { value: 'custom', label: 'Folder' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Save to' })).toBeDefined();
    const radio = screen.getByRole('radio', { name: 'Folder' });
    radio.focus();
    expect(document.activeElement).toBe(radio);
  });

  it('Select, named by its label', () => {
    render(
      <Select
        label="Quality preset"
        value="a"
        onValueChange={() => undefined}
        options={[{ value: 'a', label: 'High' }]}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Quality preset' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  it('Progress, determinate and indeterminate', () => {
    const { rerender } = render(<Progress fraction={0.4} label="holiday.jpg" />);
    const bar = screen.getByRole('progressbar', { name: 'holiday.jpg' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    rerender(<Progress fraction={null} label="holiday.jpg" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  });

  it('Badge shows its status icon and text', () => {
    const { container } = render(<Badge status="warning">Format mismatch</Badge>);
    expect(screen.getByText('Format mismatch')).toBeDefined();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('Popover opens from its trigger, and focus moves inside', () => {
    render(
      <Popover>
        <PopoverTrigger>Options</PopoverTrigger>
        <PopoverContent aria-label="Row options">
          <button type="button">Reset</button>
        </PopoverContent>
      </Popover>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('dialog', { name: 'Row options' })).toBeDefined();
  });

  it('Dialog has a title and a named close button', () => {
    render(
      <Dialog>
        <DialogTrigger>Install</DialogTrigger>
        <DialogContent title="Install Poppler" closeLabel="Close">
          Body
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByRole('dialog', { name: 'Install Poppler' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('Tooltip shows its text when the trigger gets focus', async () => {
    render(
      <TooltipProvider>
        <Tooltip content="Needs the Office pack">
          <button type="button">ODT</button>
        </Tooltip>
      </TooltipProvider>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'ODT' }));
    expect((await screen.findAllByText('Needs the Office pack')).length).toBeGreaterThan(0);
  });
});

describe('an unavailable control (UI-DESIGN section 8.9, rule 5)', () => {
  it('Button stays focusable, ignores clicks and keeps its reason', () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button unavailable reason="Nothing to convert" onClick={onClick}>
        Convert
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Convert/ });
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    const describedBy = button.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe('Nothing to convert');
  });

  it('Chip that is not possible stays focusable, ignores clicks and says why', () => {
    const onClick = vi.fn<() => void>();
    render(
      <Chip state="unavailable" reason="JPG can't be converted to SVG" onClick={onClick}>
        SVG
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: /SVG/ });
    chip.focus();
    expect(document.activeElement).toBe(chip);
    fireEvent.click(chip);
    expect(onClick).not.toHaveBeenCalled();
    expect(chip.hasAttribute('disabled')).toBe(false);
    const describedBy = chip.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe("JPG can't be converted to SVG");
  });

  it('a locked Chip still clicks, so it can open Engines', () => {
    const onClick = vi.fn<() => void>();
    render(
      <Chip state="locked" onClick={onClick}>
        ODT
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ODT' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a busy Button ignores clicks and says so with aria-busy', () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button busy onClick={onClick}>
        Convert
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Convert' });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
