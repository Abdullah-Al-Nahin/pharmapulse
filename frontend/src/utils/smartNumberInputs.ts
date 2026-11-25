/**
 * Global enhancer for all <input type="number"> fields across PharmaPulse:
 * 1. Clicking/focusing a box whose default value is "0" (or "0.00") clears it to ""
 *    with placeholder="0" so typing "5" produces "5" (never "05" or "50").
 * 2. Pressing Backspace/Delete down to empty while focused keeps the box empty during
 *    editing even if React onChange ("|| 0" / "|| 1") immediately coerces state.
 * 3. On blur, if left empty and it originally displayed "0", restores "0" safely.
 * 4. Prevents mouse-wheel scrolling from accidentally altering focused numeric inputs.
 */

let installed = false;

interface SavedZeroMeta {
  hadPlaceholder: boolean;
  prevPlaceholder: string;
  restoreValue: string;
}

const zeroMetaMap = new WeakMap<HTMLInputElement, SavedZeroMeta>();
const userClearedSet = new WeakSet<HTMLInputElement>();

const isZeroText = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return Number(trimmed) === 0;
};

export function installSmartNumberInputs(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener(
    'focusin',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number' || target.readOnly || target.disabled) return;

      const currentVal = target.value;
      const prevPlaceholder = target.getAttribute('placeholder') || '';
      const hasZeroPlaceholder = prevPlaceholder !== '' && isZeroText(prevPlaceholder);

      if (isZeroText(currentVal) || (currentVal === '' && hasZeroPlaceholder)) {
        zeroMetaMap.set(target, {
          hadPlaceholder: target.hasAttribute('placeholder'),
          prevPlaceholder,
          restoreValue: currentVal,
        });
        // Clear both value and zero-looking placeholder while focused so the box looks cleanly blank
        target.setAttribute('placeholder', '');
        if (currentVal !== '') {
          target.value = '';
        }
        userClearedSet.add(target);
      }
    },
    true
  );

  document.addEventListener(
    'input',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number' || target.readOnly || target.disabled) return;

      if (target.value === '' && document.activeElement === target) {
        userClearedSet.add(target);
        if (!zeroMetaMap.has(target)) {
          zeroMetaMap.set(target, {
            hadPlaceholder: target.hasAttribute('placeholder'),
            prevPlaceholder: target.getAttribute('placeholder') || '',
            restoreValue: target.getAttribute('min') && Number(target.getAttribute('min')) > 0
              ? String(target.getAttribute('min'))
              : '0',
          });
        }
        if (!target.hasAttribute('placeholder')) {
          target.setAttribute('placeholder', '');
        }

        // Wait for React controlled onChange ("|| 0" / "|| 1") to finish synchronously,
        // then keep DOM empty while still actively editing if React snapped it back.
        queueMicrotask(() => {
          if (
            document.activeElement === target &&
            userClearedSet.has(target) &&
            target.value !== ''
          ) {
            const num = Number(target.value);
            const minVal = target.getAttribute('min');
            if (num === 0 || (minVal && Number(minVal) > 0 && num === Number(minVal))) {
              target.value = '';
            }
          }
        });
      } else if (target.value !== '') {
        userClearedSet.delete(target);
      }
    },
    true
  );

  document.addEventListener(
    'focusout',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number') return;

      const meta = zeroMetaMap.get(target);
      if (target.value === '' && meta) {
        // Only auto-restore "0" if there was a visible "0" (or min fallback) before focus
        // and the input isn't intentionally an empty-string-for-zero optional field.
        if (meta.restoreValue !== '' && isZeroText(meta.restoreValue)) {
          target.value = meta.restoreValue;
        }
      }

      if (meta) {
        if (!meta.hadPlaceholder) {
          target.removeAttribute('placeholder');
        } else {
          target.setAttribute('placeholder', meta.prevPlaceholder);
        }
        zeroMetaMap.delete(target);
      }
      userClearedSet.delete(target);
    },
    true
  );

  document.addEventListener(
    'wheel',
    (e) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === 'number' && active === e.target) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}
