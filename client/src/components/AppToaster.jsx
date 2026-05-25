import { Toaster } from 'sonner';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'app-toast group !rounded-sm !border !border-white/10 !shadow-lg !font-sans',
          title: '!text-sm !font-semibold',
          description: '!text-xs !opacity-90',
          actionButton: '!rounded-sm !bg-[#25d366] !text-black !text-xs !font-semibold',
          cancelButton: '!rounded-sm !border !border-white/15 !text-xs',
          closeButton: '!border-white/15 !bg-black/40',
        },
      }}
    />
  );
}
