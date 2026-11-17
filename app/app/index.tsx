import { Redirect } from "expo-router";

// A rota inicial so redireciona; o Guardiao no _layout decide login vs. home.
export default function Index() {
  return <Redirect href="/login" />;
}
