import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, ShieldCheck, Upload, FolderArchive, BookOpen, Users } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import heroImg from "@/assets/hero-physiotherapy.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If already signed in, jump straight into the role dashboard
  if (user && role) {
    const dest = role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/student";
    return <Navigate to={dest} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-soft">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">منصة التسليم الأكاديمية</h1>
              <p className="text-xs text-muted-foreground">كلية العلاج الطبيعي جامعة قنا</p>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="default">تسجيل الدخول</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-12 md:py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <ShieldCheck className="h-4 w-4" />
              نظام آمن لتسليم الأبحاث
            </div>
            <h2 className="font-display text-4xl font-black leading-tight tracking-tight md:text-5xl lg:text-6xl">
              سلّم أبحاثك بكل
              <span className="block bg-gradient-to-l from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                سهولة وأمان
              </span>
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              منصة متكاملة خاصة بطلاب وأساتذة <span className="font-semibold text-foreground">كلية العلاج الطبيعي بجامعة قنا</span>،
              لإدارة مقررات الكلية وتسليم الأبحاث والأسايمنتس ومتابعة المراجعة بكل سهولة وأمان.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 shadow-elegant">
                  <BookOpen className="h-5 w-5" />
                  ابدأ الآن
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border/50 shadow-elegant">
              <img
                src={heroImg}
                alt="كلية العلاج الطبيعي جامعة قنا"
                width={1280}
                height={960}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-12 md:py-20">
        <div className="mb-12 text-center">
          <h3 className="font-display text-3xl font-bold md:text-4xl">إمكانيات المنصة</h3>
          <p className="mt-3 text-muted-foreground">كل ما يحتاجه طلاب وأساتذة كلية العلاج الطبيعي في مكان واحد</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "إدارة المقررات", desc: "أنشئ المقررات وأضف الطلاب بالرقم القومي بسهولة" },
            { icon: Users, title: "تقسيم المجموعات", desc: "نظّم الطلاب في مجموعات وكلّفهم بأبحاث مخصصة" },
            { icon: Upload, title: "رفع التسليمات", desc: "الطالب يرفع بحثه بكل سهولة ويتلقى الرد فوراً" },
            { icon: ShieldCheck, title: "مراجعة آمنة", desc: "اقبل أو ارفض التسليمات مع إبداء الملاحظات" },
            { icon: FolderArchive, title: "تحميل جماعي", desc: "حمّل كل التسليمات دفعة واحدة في أرشيف منظّم" },
            { icon: GraduationCap, title: "سجل الطالب", desc: "كل طالب يرى سجل تسليماته في كل مادة على حدة" },
          ].map((f, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-smooth hover:border-primary/30 hover:shadow-elegant"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-smooth group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-6 w-6" />
              </div>
              <h4 className="mb-2 font-display text-lg font-bold">{f.title}</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <AppFooter />
    </div>
  );
};

export default Index;
