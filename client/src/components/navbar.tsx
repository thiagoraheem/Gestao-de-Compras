import { Bell, ShoppingCart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 fixed w-full top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <ShoppingCart className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Sistema de Compras</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5 text-gray-500" />
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  3
                </Badge>
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=40&h=40" />
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium text-gray-900">João Silva</p>
                <p className="text-gray-500 text-xs">Comprador Senior</p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm">
              <LogOut className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
