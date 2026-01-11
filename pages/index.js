import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Home por defecto del proyecto (elige una)
    router.replace("/index-preview"); 
    // Alternativas:
    // router.replace("/index-free");
    // router.replace("/index-plus");
    // router.replace("/index-pro");
  }, [router]);

  return null;
}

