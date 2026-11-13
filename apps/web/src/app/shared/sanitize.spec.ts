import { plainText, sanitize } from './sanitize';

describe('sanitize', () => {
  it('drops scripts, handlers and attributes, keeps the allowed formatting', () => {
    const out = sanitize('<p onclick="x()" style="color:red">Hi <b>there</b><script>alert(1)</script><img src=x onerror=y></p><div>line</div>');
    expect(out).toBe('<p>Hi <b>there</b></p><p>line</p>');
  });
  it('reads one line per block as plain text', () => {
    expect(plainText('<h3>A</h3><ul><li>b</li><li>c</li></ul>')).toBe('A\nb\nc');
    expect(plainText('<ul><li>a<ul><li>b</li></ul></li></ul>')).toBe('a\nb');
  });
});
