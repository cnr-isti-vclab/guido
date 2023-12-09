/**
 * @file Questo file contiene i dati per la creazione della barra dei controlli.
 * 
 * @requires utils
 * @requires MiniMap
 */

const controlsBarData = (utils, minimap) => ({
    "iconsPath": "./icons/",
    "controls":
      [
        [
          { 
            "fun": utils.maximize,
            "params": [minimap],
            "eventParam": true,
            "icon": "control_bar_maximize",
            "className": "control_bar_maximize",
            "title": "Maximize",
            "iconAlt": "control_bar_minimize",
            "classNameAlt": "control_bar_minimize",
            "titleAlt": "Minimize"
          },
        ],
        [
          {
            "fun": utils.activeVisibilityManageMode,
            "params": [minimap],
            "eventParam": true,
            "icon": "control_bar_set_visibility",
            "className": "control_bar_set_visibility",
            "title": "Visibility editing mode",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          },
          {
            "fun": utils.toggleTooltips,
            "params": [minimap],
            "eventParam": true,
            "icon": "control_bar_toggle_labels",
            "className": "control_bar_toggle_labels",
            "title": "Show marker's labels",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          }
        ],
        [
          {
            "fun": utils.zoomReset,
            "params": [minimap],
            "eventParam": false,
            "icon": "control_bar_zoom_reset",
            "className": "control_bar_zoom_reset",
            "title": "Zoom reset",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          },
          {
            "fun": utils.zoom,
            "params": [minimap, 0.95],
            "eventParam": false,
            "icon": "control_bar_zoom_in",
            "className": "control_bar_zoom_in",
            "title": "Zoom in",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          },
          {
            "fun": utils.zoom,
            "params": [minimap, 1.05],
            "eventParam": false,
            "icon": "control_bar_zoom_out",
            "className": "control_bar_zoom_out",
            "title": "Zoom out",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          }
        ],
        [
          {
            "fun": utils.minimizeMap,
            "params": null,
            "eventParam": false,
            "icon": "control_bar_minimize_to_icon",
            "className": "control_bar_minimize_to_icon",
            "title": "Reduce to icon",
            "iconAlt": null,
            "classNameAlt": "",
            "titleAlt": "",
          },
        ]
      ]
  });

  export default controlsBarData;