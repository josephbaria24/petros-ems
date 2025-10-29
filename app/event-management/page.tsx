"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
  } from "@/components/ui/select"
  
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Calendar, Clock, Tag, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: string;
  name: string;
  type: string;
  price: number;
  venue: string;
  status: string;
  start_date?: string;
  end_date?: string;
}

export default function EventManagementPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Event form state
  const [form, setForm] = useState({
    name: "",
    type: "",
    price: "",
    venue: "",
    start_date: "",
    end_date: "",
  });

  // Simulate data loading
  useEffect(() => {
    setEvents([
      {
        id: "1",
        name: "Building a Safe, Resilient Workplace",
        type: "Webinar",
        price: 0,
        venue: "Microsoft Teams",
        status: "Pending",
        start_date: "2025-02-10",
        end_date: "2025-02-10",
      },
      {
        id: "2",
        name: "7th OSHE National Convention",
        type: "Physical",
        price: 7000,
        venue: "Clark Quest Hotel",
        status: "Completed",
        start_date: "2025-07-24",
        end_date: "2025-07-25",
      },
    ]);
  }, []);

  const filteredEvents = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.type) {
      toast.error("Please fill out all required fields");
      return;
    }

    const newEvent: Event = {
      id: String(Date.now()),
      name: form.name,
      type: form.type,
      price: parseFloat(form.price) || 0,
      venue: form.venue,
      status: "Pending",
      start_date: form.start_date,
      end_date: form.end_date,
    };

    setEvents((prev) => [...prev, newEvent]);
    setDialogOpen(false);
    setForm({
      name: "",
      type: "",
      price: "",
      venue: "",
      start_date: "",
      end_date: "",
    });
    toast.success("Event created successfully!");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-900">
          Event Dashboard
        </h1>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing: {filteredEvents.length} Results
          </p>
          <Input
            placeholder="Search events by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        <div className="max-h-[70vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0  z-10">
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.name}</TableCell>
                  <TableCell>
                    ₱{event.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{event.venue}</TableCell>
                  <TableCell>{event.status}</TableCell>
                  <TableCell>
                    {event.start_date
                      ? new Date(event.start_date).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {event.end_date
                      ? new Date(event.end_date).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No events found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal for creating new event */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="lg:w-[40vw] sm:w-[80vw]">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  name="name"
                  placeholder="Event name"
                  value={form.name}
                  onChange={handleInput}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                    onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                    value={form.type}
                >
                    <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="Conference">Conference</SelectItem>
                    <SelectItem value="Seminar">Seminar</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            </div>

            <div>
              <Label>Price</Label>
              <Input
                name="price"
                placeholder="₱0.00"
                type="number"
                value={form.price}
                onChange={handleInput}
              />
            </div>

            <div>
              <Label>Venue</Label>
              <Input
                name="venue"
                placeholder="e.g. Zoom, Microsoft Teams, etc."
                value={form.venue}
                onChange={handleInput}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  name="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={handleInput}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  name="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={handleInput}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
