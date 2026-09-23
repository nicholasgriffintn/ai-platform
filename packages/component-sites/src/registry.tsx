import type { SiteComponentType } from "@ngriffin_uk/polychat-library-sites";
import type { ComponentType, ReactNode } from "react";

import * as content from "./components/content.js";
import * as data from "./components/data.js";
import * as forms from "./components/forms.js";
import * as layout from "./components/layout.js";
import * as navigation from "./components/navigation.js";
import * as sections from "./components/sections.js";

export type SiteRegistryComponent = ComponentType<
  Record<string, unknown> & { children?: ReactNode }
>;

const registry = {
  Page: layout.Page,
  Section: layout.Section,
  Stack: layout.Stack,
  Grid: layout.Grid,
  Card: layout.Card,
  Divider: layout.Divider,
  Spacer: layout.Spacer,
  Tabs: layout.Tabs,
  AppShell: layout.AppShell,
  Navbar: navigation.Navbar,
  Footer: navigation.Footer,
  Breadcrumbs: navigation.Breadcrumbs,
  Hero: sections.Hero,
  FeatureGrid: sections.FeatureGrid,
  Stats: sections.Stats,
  LogoCloud: sections.LogoCloud,
  Testimonials: sections.Testimonials,
  Pricing: sections.Pricing,
  FAQ: sections.FAQ,
  CTA: sections.CTA,
  Steps: sections.Steps,
  Team: sections.Team,
  Gallery: sections.Gallery,
  Newsletter: sections.Newsletter,
  Articles: sections.Articles,
  Heading: content.Heading,
  Text: content.Text,
  Badge: content.Badge,
  Button: content.Button,
  Link: content.Link,
  Image: content.Image,
  Icon: content.Icon,
  Avatar: content.Avatar,
  List: content.List,
  Quote: content.Quote,
  Code: content.Code,
  Alert: content.Alert,
  Metric: data.Metric,
  Progress: data.Progress,
  Chart: data.Chart,
  Table: data.Table,
  KeyValue: data.KeyValue,
  EmptyState: data.EmptyState,
  Form: forms.Form,
  Input: forms.Input,
  Select: forms.Select,
  Switch: forms.Switch,
} satisfies Record<SiteComponentType, ComponentType<never>>;

export const SITE_COMPONENT_REGISTRY = registry as unknown as Record<
  SiteComponentType,
  SiteRegistryComponent
>;
