export default defineAppConfig({
  toaster: {
    position: 'bottom-right' as const,
    expand: true,
    duration: 5000,
  },
  theme: { radius: 1 },
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'neutral',
    },
    avatar: {
      slots: {
        fallback: 'font-semibold uppercase',
      },
    },
    slideover: {
      variants: {
        side: {
          right: {
            content: 'max-w-full lg:max-w-md',
          },
          left: {
            content: 'max-w-full lg:max-w-md',
          },
        },
      },
      slots: {
        content: 'overflow-y-auto overflow-x-none divide-y-0',
      },
    },
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    tabs: {
      slots: {
        root: 'gap-4',
        trigger:
          'flex-1 min-w-fit whitespace-nowrap snap-center data-[state=inactive]:text-default',
        list: 'w-full overflow-x-auto no-scrollbar sticky top-14 right-0 left-0 flex flex-nowrap overflow-x-auto max-w-full snap-x snap-mandatory scroll-smooth shadow-lg',
      },
    },
    dropdownMenu: {
      slots: {
        item: 'cursor-pointer',
      },
    },
    toast: {
      slots: {
        root: 'mx-4',
      },
    },
    radioGroup: {
      compoundVariants: [
        {
          size: 'xl',
          variant: ['card', 'table'],
          class: {
            item: 'px-3 py-2',
          },
        },
      ],
      variants: {
        variant: {
          table: {
            item: 'border-none',
          },
        },
      },
    },
  },
});
