"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Shield, Users as UsersIcon } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Usuarios
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona los usuarios del sistema
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 rounded-lg p-3">
              <UsersIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold">2</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 rounded-lg p-3">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Administradores</p>
              <p className="text-2xl font-bold">1</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 rounded-lg p-3">
              <UsersIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Operadores</p>
              <p className="text-2xl font-bold">1</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <p className="text-center text-gray-500 py-8">
          Funcionalidad de gestión de usuarios próximamente
        </p>
      </Card>
    </div>
  );
}
