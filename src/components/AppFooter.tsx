import { MessageCircle, Send } from "lucide-react";

export function AppFooter() {
  const whatsappNumber = "201113515751";
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;
  const telegramUrl = "https://t.me/Dr_Abdallah_Sabry";

  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto">
      <div className="container py-8 flex flex-col items-center gap-4 text-center">
        <div>
          <p className="font-display font-bold text-lg">برمجة وتطوير</p>
          <p className="text-primary font-display font-bold text-xl mt-1">عبدالله صبري</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success text-success-foreground hover:opacity-90 transition-smooth shadow-soft text-sm font-semibold"
          >
            <MessageCircle className="h-4 w-4" />
            <span>واتساب</span>
          </a>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-smooth shadow-soft text-sm font-semibold"
          >
            <Send className="h-4 w-4" />
            تليجرام
          </a>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          منصة تسليم الأبحاث الأكاديمية © {new Date().getFullYear()} — كلية العلاج الطبيعي جامعة قنا
        </p>
      </div>
    </footer>
  );
}
