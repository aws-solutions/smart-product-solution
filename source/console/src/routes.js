import Devices from "views/Devices.jsx";
import DeviceRegistration from "views/DeviceRegistration.jsx";
import DeviceDetail from "views/DeviceDetail.jsx";
import Alerts from "views/Alerts.jsx";
import History from "views/History.jsx";
import UserSetting from "views/UserSetting.jsx";

const dashboardRoutes = [
  {
    path: "/devices",
    name: "My Devices",
    icon: "pe-7s-home",
    component: Devices,
    layout: "/admin",
    visible: true
  },
  {
    path: "/devices/registration",
    name: "New Device Registration",
    icon: "pe-7s-home",
    component: DeviceRegistration,
    layout: "/admin",
    visible: false
  },
  {
    path: "/devices/:deviceId",
    name: "Device Detail",
    icon: "pe-7s-home",
    component: DeviceDetail,
    layout: "/admin",
    visible: false
  },
  {
    path: "/alerts",
    name: "Event Alerts",
    icon: "pe-7s-attention",
    component: Alerts,
    layout: "/admin",
    visible: true
  },
  {
    path: "/history",
    name: "Event History",
    icon: "pe-7s-note2",
    component: History,
    layout: "/admin",
    visible: true
  },
  {
    path: "/user",
    name: "User Setting",
    icon: "pe-7s-user",
    component: UserSetting,
    layout: "/admin",
    visible: true
  }
];

export default dashboardRoutes;
