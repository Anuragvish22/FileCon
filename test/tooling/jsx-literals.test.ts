import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('react/jsx-no-literals', () => {
  it('fails a component with a literal string and passes one that uses translate()', async () => {
    const eslint = new ESLint();
    const file = 'packages/app/src/renderer/components/CoreBanner.tsx';
    const lint = async (code: string) =>
      (await eslint.lintText(code, { filePath: file }))[0]?.messages.map(
        (message) => message.ruleId,
      ) ?? [];
    expect(await lint('export const Probe = () => <p>Hello</p>;\n')).toContain(
      'react/jsx-no-literals',
    );
    expect(await lint("export const Probe = () => <p>{'Hello'}</p>;\n")).toContain(
      'react/jsx-no-literals',
    );
    expect(
      await lint('export const Probe = ({ text }: { text: string }) => <p>{text}</p>;\n'),
    ).not.toContain('react/jsx-no-literals');
  });
});
