import { Toaster as Sonner } from "sonner";
import { useSettings } from "@/lib/store";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { settings } = useSettings();

  return (
    <Sonner
      theme={settings.theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-card !text-foreground !border !border-border !shadow-2xl !backdrop-blur-xl !rounded-2xl font-sans text-xs sm:text-sm p-3.5 sm:p-4",
          title: "!text-foreground !font-semibold",
          description: "!text-muted-foreground",
          actionButton:
            "!bg-primary !text-primary-foreground !rounded-xl !font-medium",
          cancelButton:
            "!bg-secondary !text-secondary-foreground !rounded-xl",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
