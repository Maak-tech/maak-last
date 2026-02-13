import { RouterProvider } from "react-router";
import { LanguageProvider } from "./context/LanguageContext";
import { router } from "./routes";

export default function App() {
  return (
    <LanguageProvider>
      <div className="mx-auto min-h-screen max-w-md bg-white shadow-2xl">
        <RouterProvider router={router} />
      </div>
    </LanguageProvider>
  );
}
