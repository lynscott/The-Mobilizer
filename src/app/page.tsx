import Image from "next/image";
import { Button, Card, Layout, Heading, Text } from "../components";
import Link from "next/link";

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-10 max-w-4xl mx-auto">
        <div className="text-center">
          <Heading level={1} underline className="mb-4">
            The Mobilizer
          </Heading>
          <Text size="xl" className="max-w-2xl mx-auto mb-6">
            The AI-powered mobility assessment tool that helps you understand your movement limitations and improve your fitness.
          </Text>
          <Link href="/questionnaire/1" passHref>
            <Button 
              variant="accent" 
              size="lg"
              className="mt-4 max-w-xs mx-auto"
            >
              Start Assessment
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          <Card title="Quick">
            <Text>
              Complete your assessment in under 5 minutes with our streamlined process.
            </Text>
          </Card>
          
          <Card title="Accurate">
            <Text>
              AI-powered analysis using PoseNet technology to accurately assess your mobility.
            </Text>
          </Card>
          
          <Card title="Actionable">
            <Text>
              Get personalized recommendations and exercises to improve your mobility right away.
            </Text>
          </Card>
        </div>

        <div className="w-full border-t border-accent/30 pt-8 mt-4">
          <Heading level={2} className="mb-6 text-center">
            How It Works
          </Heading>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-primary/40 border border-neutralMid/20 p-6 rounded-sm">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-heading mr-3">1</div>
                <Heading level={3}>Questionnaire</Heading>
              </div>
              <Text>
                Answer a few simple questions about your movement habits and limitations.
              </Text>
            </div>
            
            <div className="bg-primary/40 border border-neutralMid/20 p-6 rounded-sm">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-heading mr-3">2</div>
                <Heading level={3}>Movement Capture</Heading>
              </div>
              <Text>
                Perform simple movements in front of your camera for our AI to analyze.
              </Text>
            </div>
            
            <div className="bg-primary/40 border border-neutralMid/20 p-6 rounded-sm md:col-span-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-heading mr-3">3</div>
                <Heading level={3}>Instant Report</Heading>
              </div>
              <Text>
                Receive a detailed mobility report with insights and customized recommendations.
              </Text>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
