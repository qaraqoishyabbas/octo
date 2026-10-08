import ModalConfirmation from '~/components/shared/ModalConfirmation.vue';

type ButtonColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral';
type ButtonVariant = 'link' | 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost';

type OnFn = () => void | Promise<void>;

export type ConfirmOptions = {
  title: string;
  description?: string;

  confirmButtonText?: string;
  confirmButtonColor?: ButtonColor;
  confirmButtonVariant?: ButtonVariant;

  cancelButtonText?: string;
  cancelButtonColor?: ButtonColor;
  cancelButtonVariant?: ButtonVariant;

  onConfirm?: OnFn;
  onCancel?: OnFn;
};

export const useConfirm = () => {
  const overlay = useOverlay();

  const confirm = (opts: ConfirmOptions) => {
    overlay.create(ModalConfirmation).open({
      title: opts.title,
      description: opts.description ?? '',

      confirmButtonText: opts.confirmButtonText ?? 'Подтвердить',
      confirmButtonColor: opts.confirmButtonColor ?? 'primary',
      confirmButtonVariant: opts.confirmButtonVariant ?? 'soft',

      cancelButtonText: opts.cancelButtonText ?? 'Отмена',
      cancelButtonColor: opts.cancelButtonColor ?? 'neutral',
      cancelButtonVariant: opts.cancelButtonVariant ?? 'ghost',

      onConfirm: opts.onConfirm,
      onCancel: opts.onCancel,
    });
  };

  // Promise-режим: возвращает true/false
  const confirmAsync = (opts: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      overlay.create(ModalConfirmation).open({
        title: opts.title,
        description: opts.description ?? '',

        confirmButtonText: opts.confirmButtonText ?? 'Подтвердить',
        confirmButtonColor: opts.confirmButtonColor ?? 'primary',
        confirmButtonVariant: opts.confirmButtonVariant ?? 'soft',

        cancelButtonText: opts.cancelButtonText ?? 'Отмена',
        cancelButtonColor: opts.cancelButtonColor ?? 'neutral',
        cancelButtonVariant: opts.cancelButtonVariant ?? 'ghost',

        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  return { confirm, confirmAsync };
};
