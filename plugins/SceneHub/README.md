# 🎬 **SceneHub** 🎬

SceneHub is a customizable web platform that allows users to easily browse and discover the latest released scenes from a variety of adult websites — all in one unified interface. By leveraging custom scrapers and dynamic templates, SceneHub simplifies the discovery of scenes from sites like **Brazzers**, **Vixen**, **Bang**, and more.

---

## ✨ **Features** ✨

- 🎥 **Unified Interface**: View scenes from multiple websites conveniently on one page.
- 🔄 **Customizable Scrapers**: Automatically retrieve the latest scene information from supported websites.
- 🖼️ **Dynamic Scene Cards**: Browse newly released scenes with thumbnails, titles, performers, and release dates.
- 📱 **Mobile-Friendly Navbar**: Effortlessly switch between different content providers via a scrollable navbar.
- 🔑 **Local Stash Integration**: Seamlessly access `SceneHub` from your local **Stash** instance.

---

## 🌐 **Supported Websites** 🌐

Currently, **SceneHub** supports the following websites:

| Website           | Status   |
|-------------------|----------|
| Brazzers           | ✅ |
| Vixen              | ✅ |
| Bang               | ✅ |
| NewSensations      | ✅ |
| Lubed              | ✅ |
| Holed              | ✅ |
| Tiny4K             | ✅ |
| Exotic4K           | ✅ |
| PornPros           | ✅ |
| RealityKings       | ✅ |
| Private            | ✅ |
| Digital Playground | ✅ |

---

## ⚙️ **Requirements** ⚙️

- 🐍 **Python 3.7+**
- 🧼 **BeautifulSoup4**
- 🛠️ **Stashapp-Tools**

---

## 📝 **User Configuration** 📝

In `SceneHub.js`, configure the following options for your local **Stash** setup:

```json
{
    "scheme": "http",       // Use 'https' if applicable
    "host": "localhost",    // Your server IP or hostname
    "port": 9999,           // Stash server port
    "apiKey": "your-api-key" // API key for Stash instance
}
```

## 🚀 Steps to Run 🚀
## 1. Navigate to Stash Tasks:

Go to Stash > Settings > Tasks and run the SceneHub Scenes Update task.

## 2. Kickoff Scrapers:

This task will activate all the scrapers and generate JSON files for each supported website. These JSON files are used to populate the SceneHub web template.

## 3. Explore Scenes:

After running the scrapers, click the new SceneHub button in your Stash navbar. This redirects you to the main SceneHub page, where you can browse the most recent scenes from supported websites.

## 🛠️ Local Setup Instructions 🛠️

`pip install -r requirements.txt` from within the SceneHub plugin directory.
