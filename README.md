# Oasis 💧 - Localizador de Fuentes de Agua

Oasis es una aplicación web diseñada para ayudar a corredores, ciclistas y viajeros a encontrar puntos de hidratación cercanos de forma rápida y eficiente. Utiliza datos en tiempo real de OpenStreetMap para localizar fuentes, grifos y manantiales naturales.

## 🚀 Funcionalidades Principales

- **Localización en Tiempo Real**: Rastreo preciso de tu ubicación mediante GPS.
- **Indicador de Hidratación**: Una barra dinámica en la parte superior que te indica si estás en un "Oasis" (muy cerca), en zona "Segura" o si debes tener "Precaución" por la distancia a la fuente más cercana.
- **Modo Brújula**: Una brújula integrada que te orienta físicamente hacia la fuente más cercana.
- **Caché Inteligente**: Los datos se guardan localmente para que la app funcione instantáneamente incluso con mala conexión.
- **Keep Screen On**: Evita que la pantalla del móvil se apague mientras navegas (ideal para ciclistas).

## 🔘 Guía de Botones y Controles

### Pantalla Principal (Mapa)

1.  **Icono de Ubicación (Punto de mira)**: 
    - Te devuelve a tu posición actual en el mapa y activa el **Modo Seguimiento**.
2.  **Icono de Engranaje (Ajustes)**: 
    - Abre el panel de configuración de la aplicación.
4.  **Widget de Brújula (Abajo a la izquierda)**:
    - Al tocarlo, se activa la brújula del dispositivo para guiarte hacia la fuente más cercana.
5.  **Selector de Vista (Mapa / Lista)**:
    - Cambia entre la visualización interactiva del mapa y una lista ordenada por distancia.

### Panel de Detalles de Fuente

Al tocar cualquier fuente en el mapa, se abre un panel inferior con:

- **Tipo de Fuente**: Indica si es una fuente urbana o un manantial natural.
- **Distancia**: Cuánto te falta para llegar.
- **Botón "Navegar"**: Abre automáticamente **Google Maps** (o **Apple Maps** en iPhone) con la ruta directa.
- **Botón de Compartir**: Permite enviar la ubicación de la fuente a través de WhatsApp, Telegram o copiar el enlace.

### Menú de Ajustes ⚙️

- **Idioma**: Cambia la interfaz entre Español, Catalán e Inglés.
- **Unidades**: Elige entre sistema métrico (km/m) o imperial (mi/ft).
- **Radio de búsqueda**: Define qué tan lejos debe buscar fuentes la aplicación (desde 100m hasta 20km).
- **Tipo de Mapa**: Cambia el estilo visual (Estándar, Satélite, Terreno, Claro u Oscuro).
- **Mantener pantalla encendida**: Activa/Desactiva la función para que el móvil no se bloquee.

## 🛠️ Tecnologías Utilizadas

- **React + TypeScript**: Para una interfaz rápida y segura.
- **Tailwind CSS**: Diseño moderno y adaptativo.
- **Leaflet**: Motor de mapas interactivos.
- **Overpass API**: Acceso a los datos abiertos de OpenStreetMap.
- **Vite**: Herramienta de construcción ultra rápida.

---
Desarrollado con ❤️ para la comunidad de deportistas y aventureros.
