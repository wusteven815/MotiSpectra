import Button from "@/components/Button";
import LineGraph from "@/components/LineGraph";
import RadarGraph from "@/components/RadarGraph";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function Page() {
  const videoRef = useRef<any>(null);
  const [stream, setStream] = useState<null | MediaStream>(null);
  const [graphTab, setGraphTab] = useState<"radar" | "avg">("avg");
  const [showGrid, setShowGrid] = useState(false)
  const [showLandmark, setShowLandmark] = useState(false)
  const [boxes, setBoxes] = useState<[[number, number], [number, number]][]>([]);
  const [landmarks, setLandmarks] = useState<[number, number][]>([])
  const [analysisData, setAnalysisData] = useState<
    {
      emotion: {
        angry: number;
        disgust: number;
        fear: number;
        happy: number;
        neutral: number;
        sad: number;
        surprise: number;
      };
      engagement: {
        bored: number;
        confused: number;
        drowsy: number;
        frustrated: number;
        interested: number;
        looking_away: number;
      };
    }[]
  >([]);
  // console.log(analysisData);

  async function startStream() {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraintSet,
      });
      setStream(mediaStream);
    } catch (error) {
      console.error("Error accessing screen capture:", error);
    }
  }
  function closeStream() {
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      setStream(null);
      setBoxes([]);
    }
  }
  function takeScreenshot() {
    const canvas = document.createElement("canvas");
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg");
  }
  function addAnalysisData(emotion: Object, engagement: Object) {
    const data = [...analysisData, { emotion, engagement }] as any;
    analysisData.push({ emotion, engagement } as any);
    if (data.length > 16) data.shift();
    console.log(2, data)
    setAnalysisData([...data]);
    console.log("add analysis ended")
  }
  function movingAverage(arr: number[], windowSize = 4) {
    return arr.map((_, i, arr) => {
      if (i < windowSize) {
        return 0;
      }
      const window = arr.slice(i - windowSize, i);
      const average = window.reduce((a, b) => a + b, 0) / windowSize;
      return average;
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => closeStream(), []);
  useEffect(() => {
    async function updateLoop() {
      // wait a bit before starting
      await new Promise((resolve) => setTimeout(resolve, 250));

      while (stream && videoRef.current) {
        try {
          const image = takeScreenshot();
          if (image === "data:,") continue;
          const res = await fetch("http://127.0.0.1:5000/process-image", {
            method: "POST",
            body: JSON.stringify({
              image: image,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });
          const data = await res.json();
          setBoxes(data.boxes);
          setLandmarks(data.landmarks);
          console.log(data.landmarks);
          if (data.analysis_emotion) {
            console.log("DO STUFF")
            console.log(data)
            let emotionsToAdd = data.analysis_emotion.reduce((prev, next) => ({
              angry: prev.angry + next.angry,
              disgust: prev.disgust + next.disgust,
              fear: prev.fear + next.fear,
              happy: prev.happy + next.happy,
              neutral: prev.neutral + next.neutral,
              sad: prev.sad + next.sad,
              surprise: prev.surprise + next.surprise,

            }))
            let engagementToAdd = data.analysis_engagement.reduce((prev, next) => ({
              bored: prev.bored + next.bored,
              confused: prev.confused + next.confused,
              drowsy: prev.drowsy + next.drowsy,
              frustrated: prev.frustrated + next.frustrated,
              engaged: prev.engaged + next.engaged,
              "looking away": prev["looking away"] + next["looking away"],
            }))
            emotionsToAdd = {
              angry: emotionsToAdd.angry / data.analysis_emotion.length,
              disgust: emotionsToAdd.disgust / data.analysis_emotion.length,
              fear: emotionsToAdd.fear / data.analysis_emotion.length,
              happy: emotionsToAdd.happy / data.analysis_emotion.length,
              neutral: emotionsToAdd.neutral / data.analysis_emotion.length,
              sad: emotionsToAdd.sad / data.analysis_emotion.length,
              surprise: emotionsToAdd.surprise / data.analysis_emotion.length,
            }
            engagementToAdd = {
              bored: engagementToAdd.bored / data.analysis_engagement.length,
              confused: engagementToAdd.confused / data.analysis_engagement.length,
              drowsy: engagementToAdd.drowsy / data.analysis_engagement.length,
              frustrated: engagementToAdd.frustrated / data.analysis_engagement.length,
              interested: engagementToAdd.engaged / data.analysis_engagement.length,
              looking_away: engagementToAdd["looking away"] / data.analysis_engagement.length,
            }

            console.log(1, {emotionsToAdd, engagementToAdd})
            addAnalysisData(emotionsToAdd, engagementToAdd);
            // if (graphTab === "radar") {
            //   setGraphTab("avg")
            // } else {
            //   setGraphTab("radar")
            // };
          }
        } catch (error) {
          console.error("Error looping through capture:", error);
        }
      }
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          console.log("The screen capture was closed");
          setStream(null);
          setBoxes([]);
        };
      });
      updateLoop();
    }
  }, [stream]);

  const emotionAverage = movingAverage(
    analysisData.map((item) =>
      Math.min(
        100,
        Math.max(
          0,
          item.emotion.angry * -50 +
            item.emotion.disgust * -10 +
            item.emotion.fear * -20 +
            item.emotion.happy * 100 +
            item.emotion.neutral * 50 +
            item.emotion.sad * -20 +
            item.emotion.surprise * 60,
        ),
      ),
    ),
  );
  const engagementAverage = movingAverage(
    analysisData.map((item) =>
      Math.min(
        100,
        Math.max(
          0,
          item.engagement.bored * -50 +
            item.engagement.confused * 60 +
            item.engagement.drowsy * -20 +
            item.engagement.frustrated * 60 +
            item.engagement.interested * 150 +
            item.engagement.looking_away * -10,
        ),
      ),
    ),
  );

  console.log(3, analysisData)  

  return (
    <div className="h-dvh flex p-4 gap-4">
      <div className="flex flex-col flex-[65] gap-4">
        <div
          className={`w-full ${stream ? "max-h-[100dvh_-_76px]" : "h-[80%]"} rounded-xl outline outline-on-surface 
                     flex justify-center items-center relative`}
        >
          {stream ? (
            <div className="relative rounded-xl">
              <video
                ref={videoRef}
                className="object-fill"
                autoPlay
                playsInline
                muted
                style={{ maxWidth: "100%" }}
              />
              {showGrid && boxes.map((box, i) => (
                <div
                  style={{
                    left: `${box[0][0] * 100}%`,
                    top: `${box[0][1] * 100}%`,
                    position: "absolute",
                    width: `${box[1][0] * 100}%`,
                    height: `${box[1][1] * 100}%`,
                    outlineWidth: "3px",
                    outlineColor: "#0F0",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
              ))}
              {showLandmark && landmarks.map((landmark, i) => (
                <>
                <div
                  style={{
                    left: `${landmark[0][0] * 100}%`,
                    top: `${landmark[0][1] * 100}%`,
                    position: "absolute",
                    width: `2px`,
                    height: `2px`,
                    outlineWidth: "3px",
                    outlineColor: "#00F",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
                <div
                  style={{
                    left: `${landmark[1][0] * 100}%`,
                    top: `${landmark[1][1] * 100}%`,
                    position: "absolute",
                    width: `2px`,
                    height: `2px`,
                    outlineWidth: "3px",
                    outlineColor: "#00F",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
                <div
                  style={{
                    left: `${landmark[2][0] * 100}%`,
                    top: `${landmark[2][1] * 100}%`,
                    position: "absolute",
                    width: `2px`,
                    height: `2px`,
                    outlineWidth: "3px",
                    outlineColor: "#00F",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
                <div
                  style={{
                    left: `${landmark[3][0] * 100}%`,
                    top: `${landmark[3][1] * 100}%`,
                    position: "absolute",
                    width: `2px`,
                    height: `2px`,
                    outlineWidth: "3px",
                    outlineColor: "#00F",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
                <div
                  style={{
                    left: `${landmark[4][0] * 100}%`,
                    top: `${landmark[4][1] * 100}%`,
                    position: "absolute",
                    width: `1px`,
                    height: `1px`,
                    outlineWidth: "1px",
                    outlineColor: "#00F",
                    outlineStyle: "solid",
                  }}
                  key={i}
                />
                </>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Image
                src="/MotiSpectra-logos_white.png"
                alt="MotiSpectra"
                width={250}
                height={200}
              />
              <p className="text-headline-small font-mono font-bold">
                Use the toolbar below to start screensharing
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <Button onClick={startStream} disabled={!!stream} className="font-mono font-bold">
            Start Screensharing
          </Button>
          <Button onClick={closeStream} disabled={!stream} className="bg-error font-mono font-bold">
            Stop Screensharing
          </Button>
          <Button
            onClick={() => setShowGrid(!showGrid)}
          >
            Toggle Face Grid
          </Button>
          <Button
            onClick={() => setShowLandmark(!showLandmark)}
          >
            Toggle Face Landmarks
          </Button>
        </div>
      </div>
      <div className="flex-[35]">
        <div className="w-full flex">
          <button
            className={`${graphTab === "avg" ? "bg-primary-container" : "bg-secondary-container"} flex-1 
                        transition-colors rounded-t-xl p-3 text-label-large`}
            onClick={() => setGraphTab("avg")}
          >
            Moving Average Graphs
          </button>
          <button
            className={`${graphTab === "radar" ? "bg-primary-container" : "bg-secondary-container"} flex-1 
                        transition-colors rounded-t-xl p-3 text-label-large`}
            onClick={() => setGraphTab("radar")}
          >
            Radar Graphs
          </button>
        </div>
        <div className="w-full bg-primary-container p-3 rounded-b-xl">
          {graphTab === "radar" ? (
            <>
              <div className="w-full flex justify-center pr-[2%]">
                <div className="w-[225px]">
                  <RadarGraph
                    labels={["Happy", "Neutral", "Sad", "Disgust", "Anger", "Fear", "Surprise"]}
                    data={[
                      analysisData[analysisData.length - 1]?.emotion.happy * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.neutral * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.sad * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.disgust * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.angry * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.fear * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.emotion.surprise * 100 ?? 0,
                    ]}
                  />
                </div>
              </div>
              <div className="w-full flex justify-center pl-[6%]">
                <div className="w-[300px]">
                  <RadarGraph
                    labels={[
                      "Engaged",
                      "Looking Away",
                      "Bored",
                      "Confused",
                      "Frustrated",
                      "Drowsy",
                    ]}
                    data={[
                      analysisData[analysisData.length - 1]?.engagement.interested * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.engagement.looking_away * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.engagement.bored * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.engagement.confused * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.engagement.frustrated * 100 ?? 0,
                      analysisData[analysisData.length - 1]?.engagement.drowsy * 100 ?? 0,
                    ]}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <div className="w-[70%] flex flex-col py-8">
                <h2 className="text-title-medium mb-2 text-center">Emotion Score</h2>
                <LineGraph
                  labels={emotionAverage.slice(-12).map((item) => `${item}`)}
                  data={emotionAverage.slice(-12)}
                />
                <h2 className="text-title-medium mb-2 text-center mt-12">Engagement Score</h2>
                <LineGraph
                  labels={engagementAverage.slice(-12).map((item) => `${item}`)}
                  data={engagementAverage.slice(-12)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
